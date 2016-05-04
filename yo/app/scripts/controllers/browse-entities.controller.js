
(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.controller('BrowseEntitiesController', function($state, $q, $scope, $rootScope, $translate, $timeout, $templateCache, tc, helpers, icatSchema){
        var that = this; 
        var stateFromTo = $state.current.name.replace(/^.*?(\w+-\w+)$/, '$1');
        var entityType = stateFromTo.replace(/^.*-/, '');
        var facilityName = $state.params.facilityName;
        var facility = tc.facility(facilityName);
        var facilityId = facility.config().facilityId;
        var icat = tc.icat(facilityName);
        var gridOptions = _.merge({data: [], appScopeProvider: this}, facility.config().browse[entityType].gridOptions);
        var uiGridState = $state.params.uiGridState ? JSON.parse($state.params.uiGridState) : null;
        var pagingConfig = tc.config().paging;
        var isScroll = pagingConfig.pagingType == 'scroll';
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var page = 1;
        var canceler = $q.defer();
        var gridApi;
        var sortColumns = [];
        var stopListeningForCartChanges =  $rootScope.$on('cart:change', function(){
            updateSelections();
        });

        $scope.$on('$destroy', function(){
            canceler.resolve();
            stopListeningForCartChanges();
        });

        helpers.setupIcatGridOptions(gridOptions, entityType);
        if (gridOptions.externalFilters) { setupExternalFilters(); }
        this.gridOptions = gridOptions;
        this.isScroll = isScroll;


        _.each(this.gridOptions.columnDefs, function(columnDef){
            if(columnDef.sort){
                sortColumns.push({
                    colDef: {jpqlExpression: columnDef.jpqlExpression},
                    sort: columnDef.sort
                })
            }
        });

        sortColumns = _.sortBy(sortColumns, function(sortColumn){
            return sortColumn.sort.priority;
        });

        function setupExternalFilters() {
              gridOptions.externalFilters.filterText = "FILTERS.FILTER_TEXT";
            _.each(gridOptions.externalFilters, function(filter){
                var filterEntityType = filter.field.replace(/^(\w*)\..*$/, '$1');
                filter.fieldName = filter.field.replace(/^.*?\.?(\w*)$/, '$1');
                if (icatSchema.entityTypes[filterEntityType]) { filter.entityType = filterEntityType; }
                var out = icat.queryBuilder(filter.entityType || entityType);
                _.each($state.params, function(id, name){
                    var matches;
                    if(matches = name.match(/^(.*)Id$/)){
                        var variableName = matches[1];
                        out.where(["?.id = ?", variableName.safe(), parseInt(id)]);
                    }
                });
                out.limit(0, 50);
                out.run(canceler.promise).then(function(entities){
                    filter.options = [];
                    _.each(entities, function(entity){
                        filter.options.push(entity[filter.fieldName]);
                    });

                }, function(error) {
                    var errorMessage = error || "";
                    console.error("Failed to load external filter: " + filter.field + "\n" + errorMessage);
                })

                if(!filter.label && filter.label !== ''){
                    var entityTypeNamespace = helpers.constantify(entityType);
                    if (filter.entityType) {
                        var fieldNamespace = helpers.constantify(filter.entityType)
                    } else {
                    var fieldNamespace = helpers.constantify(filter.field);
                    }
                    filter.label = "FILTERS." + entityTypeNamespace + "." + fieldNamespace;
                }
            });
        };

        this.externalFilterChanged = function (){
            gridApi.core.raise.filterChanged();
        };

        function generateQueryBuilder(){
            var entityType = stateFromTo.replace(/^.*-/, '');
            var out = icat.queryBuilder(entityType);

            out.where(["facility.id = ?", facilityId]);

            _.each($state.params, function(id, name){
                var matches;
                if(matches = name.match(/^(.*)Id$/)){
                    var variableName = matches[1];
                    if(variableName == 'proposal'){
                        out.where(["investigation.name = ?", id]);
                    } else {
                        out.where(["?.id = ?", variableName.safe(), parseInt(id)]);
                    }
                }
            });

            if($state.params.instrumentId && (entityType == 'investigation' || entityType == 'facilityCycle' || $state.params.investigationId || $state.params.facilityCycleId)){
                out.where("investigationInstrument.id = instrument.id")
            }

            _.each(gridOptions.columnDefs, function(columnDef){
                if(!columnDef.field) return;

                if(columnDef.type == 'date' && columnDef.filters){
                    var from = columnDef.filters[0].term || '';
                    var to = columnDef.filters[1].term || '';
                    if(from != '' || to != ''){
                        from = helpers.completePartialFromDate(from);
                        to = helpers.completePartialToDate(to);
                        out.where([
                            "? between {ts ?} and {ts ?}",
                            columnDef.jpqlExpression.safe(),
                            from.safe(),
                            to.safe()
                        ]);
                    }
                } if(columnDef.type == 'number' && columnDef.filters){
                    var from = columnDef.filters[0].term || '';
                    var to = columnDef.filters[1].term || '';
                    if(from != '' || to != ''){
                        from = parseInt(from || '0');
                        to = parseInt(to || '1000000000');
                        out.where([
                            "? between ? and ?",
                            columnDef.jpqlExpression.safe(),
                            from,
                            to
                        ]);
                        out.where("datafileParameterType.name = 'run_number'")
                    }
                } else if(columnDef.type == 'string' && columnDef.filter && columnDef.filter.term) {
                    out.where([
                        "UPPER(?) like concat('%', ?, '%')", 
                        columnDef.jpqlExpression.safe(),
                        columnDef.filter.term.toUpperCase()
                    ]);
                }

                if(columnDef.field.match(/\./)){
                    var entityType =  columnDef.field.replace(/\[([^\.=>\[\]\s]+)/, function(match){ 
                        return helpers.capitalize(match.replace(/^\[/, ''));
                    }).replace(/^([^\.\[]+).*$/, '$1');
                    out.include(entityType);
                }
                
            });

            _.each(gridOptions.externalFilters, function(filter){
                if (filter.selectedOption) {
                    if (icatSchema.entityTypes[filter.entityType]) {
                        out.where(['?.? = ?', entityType.safe(), filter.jpqlExpression.safe(), filter.selectedOption]);
                    } else {
                        out.where(['?.? = ?', entityType.safe(), filter.fieldName.safe(), filter.selectedOption]);
                    }
                }
            });

            _.each(sortColumns, function(sortColumn){
                if(sortColumn.colDef){
                    out.orderBy(sortColumn.colDef.jpqlExpression, sortColumn.sort.direction);
                }
            });

            out.limit((page - 1) * pageSize, pageSize);

            return out; 
        }

        function getPage(){
            that.isLoading = true;
            return generateQueryBuilder().run(canceler.promise).then(function(entities){
                that.isLoading = false;
                _.each(entities, function(entity){
                    if(entity.getSize){
                        entity.getSize(canceler.promise);
                    }
                });
                return entities;
            });
        }

        function updateScroll(resultCount){
            if(isScroll){
                $timeout(function(){
                    var isMore = resultCount == pageSize;
                    if(page == 1) gridApi.infiniteScroll.resetScroll(false, isMore);
                    gridApi.infiniteScroll.dataLoaded(false, isMore);
                });
            }
        }

        function updateTotalItems(){
            that.totalItems = undefined;
            return generateQueryBuilder().count(canceler.promise).then(function(totalItems){
                gridOptions.totalItems = totalItems;
                that.totalItems = totalItems;
            });
        }

        function isAncestorInCart(){
            return tc.user(facilityName).cart(canceler.promise).then(function(cart){
                var out = false;
                _.each(['investigation', 'dataset'], function(entityType){
                    var entityId = $state.params[entityType + "Id"];
                    if(cart.isCartItem(entityType, entityId)){
                        out = true;
                        return false;
                    }
                });
                return out;
            });
        }

        function updateSelections(){
            var timeout = $timeout(function(){
                tc.user(facilityName).cart(canceler.promise).then(function(cart){
                    isAncestorInCart().then(function(isAncestorInCart){
                        _.each(gridOptions.data, function(row){
                            if (isAncestorInCart || cart.isCartItem(entityType.toLowerCase(), row.id)) {
                                gridApi.selection.selectRow(row);
                            } else {
                                gridApi.selection.unSelectRow(row);
                            }
                        });
                    });
                });
            });
            canceler.promise.then(function(){ $timeout.cancel(timeout); });
        }

        function saveState(){
            var uiGridState = JSON.stringify({
                columns: gridApi.saveState.save().columns,
                pageSize: pageSize,
                page: page
            });
            $state.go($state.current.name, {uiGridState: uiGridState}, {location: 'replace'});
        }

        function restoreState(){
            $timeout(function(){
                var uiGridState = $state.params.uiGridState ? JSON.parse($state.params.uiGridState) : null;
                if(uiGridState){
                    self.pageSize = uiGridState.pageSize;
                    pageSize = uiGridState.pageSize;
                    page = uiGridState.page;
                    delete uiGridState.pageSize;
                    delete uiGridState.page;
                    gridApi.saveState.restore($scope, uiGridState);
                }
            });
        }

        this.showTabs = function(row){
            $rootScope.$broadcast('rowclick', {
                'type': row.entity.entityType,
                'id' : row.entity.id,
                facilityName: facilityName
            });
        };

        this.browse = function(row) {
            row.browse(canceler);
        };

        this.downloadUrl = function(datafile){
            var idsUrl = facility.config().idsUrl;
            var sessionId = icat.session().sessionId;
            var id = datafile.id;
            var name = datafile.location.replace(/^.*\//, '');
            return idsUrl + 
                '/ids/getData?sessionId=' + encodeURIComponent(sessionId) +
                '&datafileIds=' + id +
                '&compress=false' +
                '&zip=false' +
                '&outfile=' + encodeURIComponent(name);
        };
        
        this.selectTooltip = $translate.instant('BROWSE.SELECTOR.ADD_REMOVE_TOOLTIP.TEXT');

        $templateCache.put('ui-grid/selectionRowHeaderButtons', '<div class="ui-grid-selection-row-header-buttons ui-grid-icon-ok" ng-class="{\'ui-grid-row-selected\': row.isSelected}" ng-click="selectButtonClick(row, $event)" uib-tooltip="{{grid.appScope.selectTooltip}}" tooltip-placement="right" tooltip-append-to-body="true">&nbsp;</div>');
        isAncestorInCart().then(function(isAncestorInCart){
            if(isAncestorInCart){
                that.selectTooltip = $translate.instant('BROWSE.SELECTOR.ANCESTER_IN_CART_TOOLTIP.TEXT');
            }
        });

        

        gridOptions.onRegisterApi = function(_gridApi) {
            gridApi = _gridApi;
            restoreState();

            getPage().then(function(results){
                gridOptions.data = results;
                updateTotalItems();
                updateSelections();
                updateScroll(results.length);
            });

            //sort change callback
            gridApi.core.on.sortChanged($scope, function(grid, _sortColumns){
                sortColumns = _sortColumns;
                page = 1;
                getPage().then(function(results){
                    updateScroll(results.length);
                    gridOptions.data = results;
                    updateSelections();
                    saveState();
                });
            });

            //filter change callback
            gridApi.core.on.filterChanged($scope, function(){
                canceler.resolve();
                canceler = $q.defer();
                page = 1;
                gridOptions.data = [];
                getPage().then(function(results){
                    gridOptions.data = results;
                    updateSelections();
                    updateScroll(results.length);
                    updateTotalItems();
                    saveState();
                });
            });


            gridApi.selection.on.rowSelectionChanged($scope, function(row) {
                isAncestorInCart().then(function(isAncestorInCart){
                    if(!isAncestorInCart){
                        var identity = _.pick(row.entity, ['facilityName', 'id']);
                        if(_.find(gridApi.selection.getSelectedRows(), identity)){
                            row.entity.addToCart(canceler.promise);
                        } else {
                            tc.user(facilityName).cart(canceler.promise).then(function(cart){
                                if(cart.isCartItem(row.entity.entityType, row.entity.id)){
                                    row.entity.deleteFromCart(canceler.promise);
                                }
                            });
                        }
                    } else {
                        updateSelections();
                    }
                });
            });

            gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows){
                isAncestorInCart().then(function(isAncestorInCart){
                    if(!isAncestorInCart){
                        var entitiesToAdd = [];
                        var entitiesToRemove = [];
                        _.each(rows, function(row){
                            var identity = _.pick(row.entity, ['facilityName', 'id']);
                            if(_.find(gridApi.selection.getSelectedRows(), identity)){
                                entitiesToAdd.push({
                                    entityType: row.entity.entityType.toLowerCase(),
                                    entityId: row.entity.id
                                });
                            } else {
                                entitiesToRemove.push({
                                    entityType: row.entity.entityType.toLowerCase(),
                                    entityId: row.entity.id
                                });
                            }
                        });
                        if(entitiesToAdd.length > 0) tc.user(facilityName).addCartItems(entitiesToAdd);
                        if(entitiesToRemove.length > 0) tc.user(facilityName).deleteCartItems(entitiesToRemove);
                    } else {
                        updateSelections();
                    }
                });
            });


            if(isScroll){
                //scroll down more data callback (append data)
                gridApi.infiniteScroll.on.needLoadMoreData($scope, function() {
                    page++;
                    getPage().then(function(results){
                        _.each(results, function(result){ gridOptions.data.push(result); });
                        if(results.length == 0) page--;
                        updateSelections();
                        updateScroll(results.length);
                    });
                });

                //scoll up more data at top callback (prepend data)
                gridApi.infiniteScroll.on.needLoadMoreDataTop($scope, function() {
                    page--;
                    getPage().then(function(results){
                        _.each(results.reverse(), function(result){ gridOptions.data.unshift(result); });
                        if(results.length == 0) page++;
                        updateSelections();
                        updateScroll(results.length);
                    });
                });
            } else {
                //pagination callback
                gridApi.pagination.on.paginationChanged($scope, function(_page, _pageSize) {
                    page = _page;
                    pageSize = _pageSize;
                    getPage().then(function(results){
                        gridOptions.data = results;
                        updateSelections();
                    });
                });
            }

        };

    });
})();
