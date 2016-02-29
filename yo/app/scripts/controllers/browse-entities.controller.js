
(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.controller('BrowseEntitiesController', function($state, $q, $scope, $rootScope, $translate, $timeout, $templateCache, tc, helpers, uiGridConstants){
        var that = this; 
        var stateFromTo = $state.current.name.replace(/^.*?(\w+-\w+)$/, '$1');
        var entityInstanceName = stateFromTo.replace(/^.*-/, '');
        var realEntityInstanceName = entityInstanceName;
        if(realEntityInstanceName == 'proposal') realEntityInstanceName = 'investigation';
        var facilityName = $state.params.facilityName;
        var facility = tc.facility(facilityName);
        var facilityId = facility.config().facilityId;
        var icat = tc.icat(facilityName);
        var gridOptions = _.merge({data: [], appScopeProvider: this}, facility.config().browseGridOptions[entityInstanceName]);
        var uiGridState = $state.params.uiGridState ? JSON.parse($state.params.uiGridState) : null;
        var pagingConfig = tc.config().paging;
        var isScroll = pagingConfig.pagingType == 'scroll';
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var page = 1;
        var canceler = $q.defer();
        var columnNames = _.map(gridOptions.columnDefs, function(columnDef){ return columnDef.field; });
        var isSize = _.includes(columnNames, 'size');
        var sortQuery = [];
        var filterQuery = [];
        var totalItems;
        var gridApi;
        var breadcrumb = tc.config().breadcrumb;
        var maxBreadcrumbTitleLength = breadcrumb && breadcrumb.maxTitleLength ? breadcrumb.maxTitleLength : 1000000;
        var stopListeningForCartChanges =  $rootScope.$on('cart:change', function(){
            updateSelections();
        });
        $scope.$on('$destroy', function(){
            canceler.resolve();
            stopListeningForCartChanges();
        });
        var breadcrumbTitleMap = {};
        _.each(facility.config().browseGridOptions, function(gridOptions, entityType){
            var field = "";
            _.each(gridOptions.columnDefs, function(columnDef){
                if(columnDef.breadcrumb){
                    field = columnDef.field;
                    return false;
                }
            });
            breadcrumbTitleMap[entityType] = field;
        });

        this.gridOptions = gridOptions;
        this.isScroll = isScroll;
        this.maxBreadcrumbTitleLength = maxBreadcrumbTitleLength;
        this.breadcrumbItems = [];

        var breadcrumbTimeout = $timeout(function(){
            var path = window.location.hash.replace(/^#\/browse\/facility\/[^\/]*\//, '').replace(/\/[^\/]*$/, '').split(/\//);
            var pathPairs = _.chunk(path, 2);
            var breadcrumbEntities = {};       
            var breadcrumbPromises = [];
            _.each(pathPairs, function(pathPair){
                if(pathPair.length == 2){
                    var entityType = pathPair[0];
                    var uppercaseEntityType = entityType.replace(/^(.)/, function(s){ return s.toUpperCase(); });
                    var entityId = pathPair[1];
                    if(uppercaseEntityType == 'Proposal'){
                        breadcrumbPromises.push(icat.entity("Investigation", ["where investigation.name = ?", entityId, "limit 0, 1"], canceler).then(function(entity){
                            breadcrumbEntities[entityType] = entity;
                        }));
                    } else {
                        breadcrumbPromises.push(icat.entity(uppercaseEntityType, ["where ?.id = ?", entityType.safe(), entityId, "limit 0, 1"], canceler).then(function(entity){
                            breadcrumbEntities[entityType] = entity;
                        }));
                    }
                }
            });
            $q.all(breadcrumbPromises).then(function(){
                var currentHref = window.location.hash.replace(/\?.*$/, '');
                var path = window.location.hash.replace(/^#\/browse\/facility\/[^\/]*\//, '').replace(/\?.*$/, '').replace(/\/[^\/]*$/, '').split(/\//);
                
                if(path.length > 1){
                    var pathPairs = _.chunk(path, 2);
                    _.each(pathPairs.reverse(), function(pathPair){
                        var entityType = pathPair[0];
                        var entityId = pathPair[1];
                        var entity = breadcrumbEntities[entityType];
                        var title;
                        if(entity){
                            title = entity[breadcrumbTitleMap[entityType]] || entity.title || entity.name || 'untitled';
                        } else {
                            title = 'untitled';
                        }
                        that.breadcrumbItems.unshift({
                            title: title,
                            href: currentHref
                        });
                        currentHref = currentHref.replace(/\/[^\/]*\/[^\/]*$/, '');
                    });
                }

                that.breadcrumbItems.unshift({
                    title: facility.config().title,
                    href: currentHref
                });

                that.breadcrumbItems.unshift({
                    translate: "BROWSE.BREADCRUMB.ROOT.NAME",
                    href: '#/browse/facility'
                });

                that.breadcrumbItems.push({
                    translate: 'ENTITIES.' + window.location.hash.replace(/\?.*$/, '').replace(/^.*\//, '').toUpperCase() + '.NAME'
                });

            });

        });


        canceler.promise.then(function(){ $timeout.cancel(breadcrumbTimeout); });
        

        function generateQuery(stateFromTo, isCount){
            var queries = {
                'facility-proposal': [
                    'select ' + item('DISTINCT investigation.name') + ' from Investigation investigation, investigation.facility facility',
                    'where facility.id = ?', facilityId
                ],
                'facility-instrument': [
                    'select ' + item('instrument') + ' from Instrument instrument, instrument.facility facility',
                    'where facility.id = ?', facilityId
                ],
                'instrument-facilityCycle': [
                    'select ' + item('facilityCycle') + ' from',
                    'FacilityCycle facilityCycle,',
                    'facilityCycle.facility facility,',
                    'facility.investigations investigation,',
                    'investigation.investigationInstruments investigationInstrument,',
                    'investigationInstrument.instrument instrument',
                    'where facility.id = ?', facilityId,
                    'and instrument.id = ?', $state.params.instrumentId,
                    'and investigation.startDate BETWEEN facilityCycle.startDate AND facilityCycle.endDate'
                ],
                'facilityCycle-proposal': [
                    'select ' + item('DISTINCT investigation.name') + ' from',
                    'Investigation investigation,',
                    'investigation.investigationInstruments investigationInstrument,',
                    'investigationInstrument.instrument instrument,',
                    'instrument.facility facility,',
                    'facility.facilityCycles facilityCycle',
                    'where facility.id = ?', facilityId,
                    'and instrument.id = ?', $state.params.instrumentId,
                    'and facilityCycle.id = ?', $state.params.facilityCycleId,
                    'and investigation.startDate BETWEEN facilityCycle.startDate AND facilityCycle.endDate'
                ],
                'proposal-investigation': [
                    'select ' + item('investigation') + ' from Investigation investigation',
                    'where investigation.name = ?', $state.params.proposalId
                ],
                'investigation-dataset': [
                    'select ' + item('dataset') + ' from Dataset dataset, dataset.investigation investigation',
                    'where investigation.id = ?', $state.params.investigationId
                ],
                'dataset-datafile': [
                    'select ' + item('datafile') + ' from Datafile datafile, datafile.dataset dataset',
                    'where dataset.id = ?', $state.params.datasetId
                ]
            };

            //maybe use some sort of safe string feature instead.
            function item(defaultExpression){
                var out = defaultExpression;
                if(isCount) out = "count(" + out + ")";
                return out;
            }

            var out = [queries[stateFromTo], filterQuery, sortQuery];

            if(!isCount) out.push('limit ?, ?', function(){ return (page - 1) * pageSize; }, function(){ return pageSize; });
            
            var includes = gridOptions.includes;
            if(includes) out.push('include ' + includes.join(', '))

            return out;
        }

        function getPage(){
            var out = icat.query(canceler.promise, generateQuery(stateFromTo));
            if(entityInstanceName == 'proposal'){
                var defered = $q.defer();
                out.then(function(names){
                    var promises = [];
                    var proposals = [];

                    _.each(names, function(name){
                        promises.push(icat.query(canceler.promise, [
                            "select investigation from Investigation investigation",
                            "where investigation.name = ?", name,
                            "limit 0, 1"
                        ]).then(function(proposal){
                            proposal = proposal[0];
                            proposal.entityType = "Proposal";
                            proposal.id = proposal.name;
                            proposals.push(proposal);
                        }));
                    });
                    
                    $q.all(promises).then(function(){
                        var proposalIndex = {};
                        _.each(proposals, function(proposal){
                            proposalIndex[proposal.name] = proposal
                        });
                        defered.resolve(_.map(names, function(name){ return proposalIndex[name]; }));
                    });
                    
                });
                out = defered.promise;
            }
            if(isSize){
                out.then(function(results){
                    _.each(results, function(result){ result.getSize(canceler.promise); });
                });
            }
            return out;
        }

        function updateFilterQuery(){
            filterQuery = [];
            _.each(gridOptions.columnDefs, function(columnDef){
                if(columnDef.type == 'date' && columnDef.filters){
                    var from = columnDef.filters[0].term || '';
                    var to = columnDef.filters[1].term || '';
                    if(from != '' || to != ''){
                        from = helpers.completePartialFromDate(from);
                        to = helpers.completePartialToDate(to);
                        filterQuery.push([
                            "and ? between {ts ?} and {ts ?}",
                            columnDef.jpqlExpression.safe(),
                            from.safe(),
                            to.safe()
                        ]);
                    }
                } else if(columnDef.type == 'string' && columnDef.filter && columnDef.filter.term) {
                    filterQuery.push([
                        "and UPPER(?) like concat('%', ?, '%')", 
                        columnDef.jpqlExpression.safe(),
                        columnDef.filter.term.toUpperCase()
                    ]);
                }
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
            icat.query(canceler.promise, generateQuery(stateFromTo, true)).then(function(_totalItems){
                gridOptions.totalItems = _totalItems;
                totalItems = _totalItems;
                that.totalItems = totalItems[0];
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
                            if (isAncestorInCart || cart.isCartItem(entityInstanceName.toLowerCase(), row.id)) {
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


        this.getNextRouteUrl = function(row){
            var hierarchy = facility.config().hierarchy
            var stateSuffixes = {};
            _.each(hierarchy, function(currentEntityType, i){
                stateSuffixes[currentEntityType] = _.slice(hierarchy, 0, i + 2).join('-');
            });
            var params = _.clone($state.params);
            delete params.uiGridState;
            params[entityInstanceName + 'Id'] = row.id || row.name;
            return $state.href('home.browse.facility.' + stateSuffixes[entityInstanceName], params);
        };

        gridOptions.rowTemplate = '<div ng-click="grid.appScope.showTabs(row)" ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }" ui-grid-cell></div>',
        this.showTabs = function(row) {
            $rootScope.$broadcast('rowclick', {
                'type': row.entity.entityType.toLowerCase(),
                'id' : row.entity.id,
                facilityName: facilityName
            });
        };

        var sortColumns = [];
        _.each(gridOptions.columnDefs, function(columnDef){
            if(columnDef.link) {
                columnDef.cellTemplate = columnDef.cellTemplate || '<div class="ui-grid-cell-contents" title="TOOLTIP"><a ng-click="$event.stopPropagation();" href="{{grid.appScope.getNextRouteUrl(row.entity)}}">{{row.entity.' + columnDef.field + '}}</a></div>';
            }

            if(columnDef.type == 'date'){
                if(columnDef.field && columnDef.field.match(/Date$/)){
                    columnDef.filterHeaderTemplate = '<div class="ui-grid-filter-container" datetime-picker only-date ng-model="col.filters[0].term" placeholder="From..."></div><div class="ui-grid-filter-container" datetime-picker only-date ng-model="col.filters[1].term" placeholder="To..."></div>';
                } else {
                    columnDef.filterHeaderTemplate = '<div class="ui-grid-filter-container" datetime-picker ng-model="col.filters[0].term" placeholder="From..."></div><div class="ui-grid-filter-container" datetime-picker ng-model="col.filters[1].term" placeholder="To..."></div>';
                }
            }

            if(columnDef.excludeFuture){
                var date = new Date();
                var day = date.getDate();
                var month = "" + (date.getMonth() + 1);
                if(month.length == 1) month = '0' + month;
                var year = date.getFullYear();
                var filter = year + '-' + month + '-' + day;
                $timeout(function(){
                    columnDef.filters[1].term = filter;
                    saveState();
                });
            }

            if(columnDef.field == 'size'){
                columnDef.cellTemplate = columnDef.cellTemplate || '<div class="ui-grid-cell-contents"><span us-spinner="{radius:2, width:2, length: 2}"  spinner-on="row.entity.size === undefined" class="grid-cell-spinner"></span><span>{{row.entity.size|bytes}}</span></div>';
                columnDef.enableSorting = false;
                columnDef.enableFiltering = false;
            }

            if(columnDef.translateDisplayName){
                columnDef.displayName = columnDef.translateDisplayName;
                columnDef.headerCellFilter = 'translate';
            }

            if(columnDef.field == 'instrumentNames'){
                columnDef.cellTemplate = '<div class="ui-grid-cell-contents" ng-if="row.entity.investigationInstruments.length > 1"><span class="glyphicon glyphicon-th-list" uib-tooltip="{{row.entity.instrumentNames}}" tooltip-placement="top" tooltip-append-to-body="true"></span> {{row.entity.firstInstrumentName}}</div><div class="ui-grid-cell-contents" ng-if="row.entity.investigationInstruments.length <= 1">{{row.entity.firstInstrumentName}}</div>';
            }

            if(columnDef.sort){
                if(columnDef.sort.direction.toLowerCase() == 'desc'){
                    columnDef.sort.direction = uiGridConstants.DESC;
                } else {
                    columnDef.sort.direction = uiGridConstants.ASC;
                }
            }

            columnDef.jpqlExpression = columnDef.jpqlExpression || realEntityInstanceName + '.' + columnDef.field;
            if(columnDef.sort) sortColumns.push(columnDef);
        });

        if(sortColumns.length > 0){
            sortQuery.push('order by ' + _.map(sortColumns, function(sortColumn){
                return sortColumn.jpqlExpression + ' ' + sortColumn.sort.direction;
            }).join(', '));
        }

        if(gridOptions.enableDownload){
            gridOptions.columnDefs.push({
                name : 'actions',
                visible: true,
                translateDisplayName: 'BROWSE.COLUMN.ACTIONS.NAME',
                enableFiltering: false,
                enable: false,
                enableColumnMenu: false,
                enableSorting: false,
                enableHiding: false,
                cellTemplate : '<div class="ui-grid-cell-contents"><a type="button" class="btn btn-primary btn-xs" translate="BROWSE.COLUMN.ACTIONS.LINK.DOWNLOAD.TEXT" uib-tooltip="{{\'BROWSE.COLUMN.ACTIONS.LINK.DOWNLOAD.TOOLTIP.TEXT\' | translate}}" tooltip-placement="right" tooltip-append-to-body="true" href="{{grid.appScope.downloadUrl(row.entity)}}" target="_blank"></a></div>'
            });
        }

        

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

        gridOptions.paginationPageSizes = pagingConfig.paginationPageSizes;
        gridOptions.paginationNumberOfRows = pagingConfig.paginationNumberOfRows;
        gridOptions.useExternalPagination = true;
        gridOptions.useExternalSorting = true;
        gridOptions.useExternalFiltering = true;
        var enableSelection = gridOptions.enableSelection === true && entityInstanceName.match(/^investigation|dataset|datafile$/) !== null;
        gridOptions.enableSelectAll = false;
        gridOptions.enableRowSelection = enableSelection;
        gridOptions.enableRowHeaderSelection = enableSelection;
        
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
            gridApi.core.on.sortChanged($scope, function(grid, sortColumns){
                sortQuery = [];
                if(sortColumns.length > 0){
                    sortQuery.push('order by ' + _.map(sortColumns, function(sortColumn){
                        return sortColumn.colDef.jpqlExpression + ' ' + sortColumn.sort.direction;
                    }).join(', '));
                }
                page = 1;
                getPage().then(function(results){
                    updateScroll(results.length);
                    gridOptions.data = results;
                    updateSelections();
                    saveState();
                });
            });

            //filter change calkback
            gridApi.core.on.filterChanged($scope, function() {
                canceler.resolve();
                canceler = $q.defer();
                updateFilterQuery();
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
