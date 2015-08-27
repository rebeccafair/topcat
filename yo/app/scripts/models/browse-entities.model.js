'use strict';

angular
    .module('angularApp')
    .service('BrowseEntitiesModel', BrowseEntitiesModel);

BrowseEntitiesModel.$inject = ['$rootScope', 'APP_CONFIG', 'Config', 'RouteService', 'uiGridConstants', 'DataManager', '$timeout', '$state', 'Cart', 'IdsManager', 'usSpinnerService', 'inform', '$log'];

//TODO infinite scroll not working as it should when results are filtered. This is because the last page is determined by total items
//rather than the filtered total. We need to make another query to get the filtered total in order to make it work
//
//TODO sorting need fixing, ui-grid sorting is additive only rather than sorting by a single column. Queries are
//unable to do this at the moment. Do we want single column sort or multiple column sort. ui-grid currently does not
//support single column soting but users have submitted is as a feature request
function BrowseEntitiesModel($rootScope, APP_CONFIG, Config, RouteService, uiGridConstants, DataManager, $timeout, $state, Cart, IdsManager, usSpinnerService, inform, $log){  //jshint ignore: line
    var self = this;

    function getSelectableParentEntities(facility, currentEntityType, hierarchy) {
        var h = hierarchy.slice(0);
        var index = h.indexOf(currentEntityType);

        //current entity not in hierarchy!! should never happen but just in case
        if (index === -1) {
            return false;
        }

        var previousEntities = h.splice(0, index);

        //only interested in investigation or dataset
        var selectableEntities = [];

        _.each(previousEntities, function(entityType) {
            if (entityType === 'investigation' || entityType === 'dataset') {
                selectableEntities.push(entityType);
            }
        });

        //return false as there are no selectable entities as no point carry on
        if (selectableEntities.length === 0) {
            return [];
        }

        var gridOptions = Config.getBrowseOptionsByFacilityName(APP_CONFIG, facility.facilityName);
        var parentEntities = [];

        //check column def to see if investigation or dataset is selectable
        _.each(selectableEntities, function(entityType) {
            if (gridOptions[entityType].enableSelection === true) {
                parentEntities.push(entityType);
            }
        });

        return parentEntities;
    }

    function hasField(options, field) {
        var result = false;
        //determine if field size has been defined
        _.each(options.columnDefs, function(col) {
            if (typeof col.field !== 'undefined' && col.field === field) {
                result = true;
                return false;
            }
        });

        return result;
    }

    function configToUIGridOptions(facility, currentEntityType) {
        //$log.debug('BrowseEntitiesModel configToUIGridOptions called');
        //$log.debug('BrowseEntitiesModel configToUIGridOptions currentEntityType', currentEntityType);

        var gridOpts = Config.getEntityBrowseOptionsByFacilityName(APP_CONFIG, facility.facilityName, currentEntityType);

        //$log.debug('BrowseEntitiesModel gridOptions', gridOptions);

        //do the work of transposing
        _.mapValues(gridOpts.columnDefs, function(value) {
            //replace filter condition to one expected by ui-grid
            if (angular.isDefined(value.filter)) {
                if (angular.isDefined(value.filter.condition) && angular.isString(value.filter.condition)) {
                    value.filter.condition = uiGridConstants.filter[value.filter.condition.toUpperCase()];
                }
            }

            //replace translate text
            if (angular.isDefined(value.translateDisplayName) && angular.isString(value.translateDisplayName)) {
                value.displayName = value.translateDisplayName;
                delete value.translateDisplayName;

                value.headerCellFilter = 'translate';
            }

            //default type to string if not defined
            if (! angular.isDefined(value.type)) {
                value.type = 'string';
            }

            $log.debug('value', value);

            if (angular.isDefined(value.type) && value.type === 'date') {
                //value.filterHeaderTemplate = '<div class="ui-grid-filter-container" ng-repeat="colFilter in col.filters"><input class="form-control input-sm" datepicker-popup type="date" ng-model="colFilter.term" /></filter-datepicker></div>';
            }

            if (angular.isDefined(value.sort) && angular.isObject(value.sort)) {
                if (angular.isDefined(value.sort.direction) && angular.isString(value.sort.direction)) {
                    value.sort.direction = uiGridConstants[value.sort.direction.toUpperCase()];
                }
            }

            //replace links
            if (angular.isDefined(value.link) && value.link === true) {
                //$log.debug('link value', value);
                delete value.link;
                value.cellTemplate = '<div class="ui-grid-cell-contents" title="TOOLTIP"><a ng-click="$event.stopPropagation();" href="{{grid.appScope.getNextRouteUrl(row)}}">{{row.entity.' + value.field + '}}</a></div>';
            }

            //add suppress remove sort
            if (! angular.isDefined(value.suppressRemoveSort)) {
                //value.suppressRemoveSort = true;
            }

            //size column
            //make sure for only investigation and dataset
            if (currentEntityType === 'investigation' || currentEntityType === 'dataset') {
                if(angular.isDefined(value.field) && value.field === 'size') {
                    value.cellTemplate = '<div class="ui-grid-cell-contents"><span us-spinner="{radius:2, width:2, length: 2}" spinner-key="spinner-size-{{row.uid}}" class="grid-cell-spinner"></span><span>{{ row.entity.size | bytes }}</span></div>';
                    value.enableSorting = false;
                    value.enableFiltering = false;
                }
            }

            return value;
        });

        return gridOpts;
    }

    function makeGridNoUnselect(facility, currentEntityType, structure, $stateParams, gridOptions) {
        $log.debug('makeRowUnselectable called');
        var selectableEntities = getSelectableParentEntities(facility, currentEntityType, structure);

        $log.debug('cartItems', Cart.getItems());

        $log.debug('makeRowUnselectable selectableEntities', selectableEntities);

        if (selectableEntities.length !== 0) {
            $log.debug('makeRowUnselectable length greater than 0');
            var isInCart = false;

            //deal with investigation parent
            _.each(selectableEntities, function(entityType) {
                var id = $stateParams[entityType + 'Id'];

                $log.debug('makeRowUnselectable id:', id);

                if(typeof id === 'string') {
                    id = parseInt(id);
                }

                $log.debug('getItem params', facility.facilityName, entityType, id);

                var item = Cart.getItem(facility.facilityName, entityType, id);

                $log.debug('makeRowUnselectable item:', item);

                if (item !== false) {
                    isInCart = true;
                }
            });

            $log.debug('makeRowUnselectable isInCart:' + isInCart);

            if (isInCart === true) {
                gridOptions.noUnselect = true;

                gridOptions.isRowSelectable = function(row) {
                    //preselect the row
                    row.isSelected = true;
                    return false;
                };
            }
        }
    }


    this.init = function(facility, scope, currentEntityType, currentRouteSegment, sessions, $stateParams) {
            self.facility = facility;
            self.scope = scope;
            self.currentEntityType = currentEntityType;
            self.currentRouteSegment = currentRouteSegment;
            self.sessions = sessions;
            self.stateParams = $stateParams;

            self.options = configToUIGridOptions(facility, currentEntityType);
            self.structure = Config.getHierarchyByFacilityName(APP_CONFIG, facility.facilityName);
            self.nextRouteSegment = RouteService.getNextRouteSegmentName(self.structure, currentEntityType);
            self.pagingType = Config.getSitePagingType(APP_CONFIG); //the pagination type. 'scroll' or 'page'
            self.pageSize = Config.getSitePageSize(APP_CONFIG, self.pagingType); //the number of rows for grid
            self.scrollRowFromEnd = Config.getSiteConfig(APP_CONFIG).scrollRowFromEnd;
            self.paginationPageSizes = Config.getSiteConfig(APP_CONFIG).paginationPageSizes; //the number of rows for grid
            self.gridOptions = scope.gridOptions;
            self.hasSizeField = hasField(self.options, 'size');

            self.setGridOptions(self.scope.gridOptions);

            self.paginateParams = {
                start: 0,
                numRows: self.pageSize,
                sortField: 'name',
                order: 'asc',
                includes: self.options.includes
            };

            //this.makeRowUnselectable(self.facility, self.currentEntityType, self.structure, self.stateParams, self.gridOptions);
            makeGridNoUnselect(self.facility, self.currentEntityType, self.structure, self.stateParams, self.gridOptions);

    };


    this.setGridOptions = function(gridOptions) {
        self.gridOptions = _.extend(gridOptions, {
            enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
            columnDefs: self.options.columnDefs,
            enableFiltering: self.options.enableFiltering,
            useExternalSorting: true,
            useExternalFiltering: true,
            enableRowSelection: self.enableSelection(),
            enableRowHeaderSelection: self.enableSelection(),
            enableSelectAll: false,
            //modifierKeysToMultiSelect: true,
            multiSelect: true,
            //flatEntityAccess: true,
            rowTemplate: '<div ng-click="grid.appScope.showTabs(row)" ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }" ui-grid-cell></div>'
        });

        if (self.pagingType === 'page') {
            self.gridOptions.paginationPageSizes = self.paginationPageSizes;
            self.gridOptions.paginationPageSize = self.pageSize;
            self.gridOptions.useExternalPagination = true;
        } else {
            self.gridOptions.infiniteScrollRowsFromEnd = self.scrollRowFromEnd;
            self.gridOptions.infiniteScrollUp = true;
            self.gridOptions.infiniteScrollDown = true;
        }

        $log.debug('self.gridOptions after setGridOptions', self.gridOptions);
    };

    /*this.makeRowUnselectable = function(facility, currentEntityType, structure, $stateParams, gridOptions) {
        $log.debug('makeRowUnselectable called');
        var selectableEntities = getSelectableParentEntities(facility, currentEntityType, structure);

        $log.debug('cartItems', Cart.getItems());

        $log.debug('makeRowUnselectable selectableEntities', selectableEntities);

        if (selectableEntities.length !== 0) {
            $log.debug('makeRowUnselectable length greater than 0');
            var isInCart = false;

            //deal with investigation parent
            _.each(selectableEntities, function(entityType) {
                var id = $stateParams[entityType + 'Id'];

                $log.debug('makeRowUnselectable id:', id);

                if(typeof id === 'string') {
                    id = parseInt(id);
                }

                $log.debug('getItem params', facility.facilityName, entityType, id);

                var item = Cart.getItem(facility.facilityName, entityType, id);

                $log.debug('makeRowUnselectable item:', item);

                if (item !== false) {
                    isInCart = true;
                }
            });

            $log.debug('makeRowUnselectable isInCart:' + isInCart);

            if (isInCart === true) {
                gridOptions.isRowSelectable = function(row) {
                    $log.debug('makeRowUnselectable row:', row);

                    //preselect the row
                    row.isSelected = true;
                    return false;
                };
            }
        }
    };*/

    /**
     * Loads data for both pagination and infinte scroll. This method is called by ui-grid to load the first page of data
     * for infinite scroll and to load next page data for paginated pages
     * @return {[type]} [description]
     */
    this.getPage = function() {
        //$log.debug('getpage called', paginateParams);
        $log.debug('getData options self.currentRouteSegment', self.currentRouteSegment);
        $log.debug('getData options self.facility.facilityName', self.facility.facilityName);
        $log.debug('getData options self.sessions', self.sessions);
        $log.debug('getData options self.stateParams', self.stateParams);
        $log.debug('getData options self.paginateParams', self.paginateParams);

        $log.debug('self.gridOptions', self.gridOptions);

        DataManager.getData(self.currentRouteSegment, self.facility.facilityName, self.sessions, self.stateParams, self.paginateParams).then(function(data){
            self.gridOptions.data = data.data;
            self.gridOptions.totalItems = data.totalItems;

            if (data.totalItems === 0) {
                self.scope.isEmpty = true;
            } else {
                self.scope.isEmpty = false;
            }

            if (self.pagingType === 'scroll') {
                self.scope.lastPage = Math.ceil(data.totalItems / self.pageSize);
                self.scope.gridApi.infiniteScroll.dataLoaded(self.scope.firstPage - 1 > 0, self.scope.currentPage + 1 < self.scope.lastPage);
            }

            $timeout(function() {
                var rows = self.scope.gridApi.core.getVisibleRows(self.scope.gridApi.grid);

                //pre-select items in cart here
                _.each(rows, function(row) {
                    //fill size data
                    if (self.hasSizeField) {
                        //$log.debug('has size field');
                        if (self.currentEntityType === 'investigation' || self.currentEntityType === 'dataset') {
                            if (typeof row.entity.size === 'undefined' || row.entity.size === null) {
                                var params = {};
                                params[self.currentEntityType  + 'Ids'] = row.entity.id;

                                usSpinnerService.spin('spinner-size-' + row.uid);

                                IdsManager.getSize(self.sessions, self.facility, params).then(function(data){
                                    row.entity.size = parseInt(data);
                                    usSpinnerService.stop('spinner-size-' + row.uid);
                                }, function(error) {
                                    row.entity.size = -1;
                                    usSpinnerService.stop('spinner-size-' + row.uid);

                                    $log.debug(error);
                                    inform.add(error, {
                                        'ttl': 4000,
                                        'type': 'danger'
                                    });
                                });
                            }
                        }
                    }

                    //select the row if item is in the cart
                    if (Cart.hasItem(self.facility.facilityName, self.currentEntityType, row.entity.id)) {
                       self.scope.gridApi.selection.selectRow(row.entity);
                    }
                });

            }, 0);
        }, function(error){
            $log.debug('Unable to retrieve data:' + error);

        });
    };


    self.appendPage = function() {
        //$log.debug('append called', paginateParams);

        DataManager.getData(self.currentRouteSegment, self.facility.facilityName, self.sessions, self.stateParams, self.paginateParams).then(function(data){
            self.gridOptions.data = self.gridOptions.data.concat(data.data);
            self.gridOptions.totalItems = data.totalItems;

            $timeout(function() {
                var rows = self.scope.gridApi.core.getVisibleRows(self.scope.gridApi.grid);

                //pre-select items in cart here
                _.each(rows, function(row) {
                    //file size data
                    if (self.hasSizeField) {
                        //$log.debug('has size field');
                        if (self.currentEntityType === 'investigation' || self.currentEntityType === 'dataset') {
                            if (typeof row.entity.size === 'undefined' || row.entity.size === null) {
                                var params = {};
                                params[self.currentEntityType  + 'Ids'] = row.entity.id;

                                IdsManager.getSize(self.sessions, self.facility, params).then(function(data){
                                    row.entity.size = parseInt(data);
                                }, function() {
                                    row.entity.size = -1;
                                });
                            }
                        }
                    }

                    if (Cart.hasItem(self.facility.facilityName, self.currentEntityType, row.entity.id)) {
                       self.scope.gridApi.selection.selectRow(row.entity);
                    }
                });

            }, 0);


        }, function(){

        });
    };

    /**
     * Loads data for infinite scroll. This method is call by ui-grid when user scrolls down
     * @return {[type]} [description]
     */
    this.prependPage = function() {
        DataManager.getData(self.urrentRouteSegment, self.facility.facilityName, self.sessions, self.stateParams, self.paginateParams).then(function(data){
            self.gridOptions.data = data.data.concat(self.gridOptions.data);
            self.gridOptions.totalItems = data.totalItems;

            $timeout(function() {
                var rows = self.scope.gridApi.core.getVisibleRows(self.scope.gridApi.grid);

                //pre-select items in cart here
                _.each(rows, function(row) {
                    //file size data
                    if (self.currentEntityType === 'investigation' || self.currentEntityType === 'dataset') {
                        if (typeof row.entity.size === 'undefined' || row.entity.size === null) {
                            var params = {};
                            params[self.currentEntityType  + 'Ids'] = row.entity.id;

                            IdsManager.getSize(self.sessions, self.facility, params).then(function(data){
                                row.entity.size = parseInt(data);
                            }, function() {
                                row.entity.size = -1;
                            });
                        }
                    }

                    if (Cart.hasItem(self.facility.facilityName, self.currentEntityType, row.entity.id)) {
                       self.scope.gridApi.selection.selectRow(row.entity);
                    }
                });
            }, 0);
        }, function(){

        });
    };

    this.refreshSelection = function() {
        $timeout(function() {
            var rows = self.scope.gridApi.core.getVisibleRows(self.scope.gridApi.grid);

            //pre-select items in cart here
            _.each(rows, function(row) {
                if (Cart.hasItem(self.facility.facilityName, self.currentEntityType, row.entity.id)) {
                   self.scope.gridApi.selection.selectRow(row.entity);
                } else {
                    self.scope.gridApi.selection.unSelectRow(row.entity);
                }
            });

        }, 0);
    };


    this.enableSelection = function() {
        if (angular.isDefined(self.options.enableSelection) && self.options.enableSelection === true) {
            return true;
        } else {
            return false;
        }
    };


    this.getNextRouteUrl = function (row) {
        var params = {
            facilityName : self.facility.facilityName,
            //id : row.entity.id
        };

        params[self.currentEntityType + 'Id'] = row.entity.id;

        _.each(self.stateParams, function(value, key){
            params[key] = value;
        });

        var route = $state.href('home.browse.facility.' + self.nextRouteSegment, params);

        return route;
    };

    //page sort callback
    this.sortChangedForPage = function(grid, sortColumns) {
        if (sortColumns.length === 0) {
            //paginationOptions.sort = null;
        } else {
            //$log.debug('sortColumns[0].field', sortColumns[0].field);
            self.paginateParams.sortField = sortColumns[0].field;
            self.paginateParams.order = sortColumns[0].sort.direction;
        }

        //$log.debug('sortChanged paginateParams', paginateParams);
        self.getPage();
    };

    //pagination callback
    this.paginationChangedForPage = function(newPage, pageSize) {
        self.paginateParams.pageNumber = newPage;
        self.paginateParams.pageSize = pageSize;

        self.paginateParams.start = (self.paginateParams.pageNumber - 1) * self.paginateParams.pageSize;
        self.paginateParams.numRows = self.paginateParams.pageSize;
        self.getPage();
    };

    this.filterChangedForPage = function (grid) {
        var sortOptions = [];

        _.each(grid.columns, function(value, index) {
            $log.debug('grid.columns[' + index + ']', grid.columns[index]);

            sortOptions.push({
                field: grid.columns[index].field,
                search: grid.columns[index].filters[0].term,
            });
        });

        self.paginateParams.search = sortOptions;

        self.getPage();
    };


    //sort callback
    this.sortChangedForScroll = function(grid, sortColumns) {
        //$log.debug('sortChanged callback grid', grid);
        //$log.debug('sortChanged callback sortColumns', sortColumns);

        if (sortColumns.length === 0) {
            //paginationOptions.sort = null;
        } else {
            sortColumns = [sortColumns[0]];
            //$log.debug('sort Column  by', sortColumns[0].field);
            self.paginateParams.sortField = sortColumns[0].field;
            self.paginateParams.order = sortColumns[0].sort.direction;
        }

        //$log.debug('sortChanged callback sortColumns after', sortColumns);

        self.scope.firstPage = 1;
        self.scope.currentPage = 1;
        self.paginateParams.start = 0;

        $timeout(function() {
            self.scope.gridApi.infiniteScroll.resetScroll(self.scope.firstPage - 1 > 0, self.scope.currentPage + 1 < self.scope.lastPage);
        });

        self.getPage();

        //$log.debug('sortChanged paginateParams', paginateParams);
    };

    this.needLoadMoreDataForScroll = function() {
        //$log.debug('needLoadMoreData called');
        //$log.debug('curentPage: ' , scope.currentPage, 'lastPage: ', scope.lastPage);
        self.paginateParams.start = self.paginateParams.start + self.pageSize;
        self.scope.gridApi.infiniteScroll.saveScrollPercentage();
        self.appendPage(self.paginateParams);

        //$log.debug ('scrollUp: ', scope.firstPage - 1 > 0);
        //$log.debug ('scrollDown: ', scope.currentPage + 1 < scope.lastPage);

        self.scope.gridApi.infiniteScroll.dataLoaded(self.scope.firstPage - 1 > 0, self.scope.currentPage + 1 < self.scope.lastPage);
        self.scope.currentPage++;
    };


    this.needLoadMoreDataTopForScroll = function() {
        //$log.debug('needLoadMoreDataTop called');
        //$log.debug('curentPage: ' , scope.currentPage, 'lastPage: ', scope.lastPage);
        self.paginateParams.start = self.paginateParams.start - self.pageSize;
        self.scope.gridApi.infiniteScroll.saveScrollPercentage();
        self.prependPage(self.paginateParams);

        //$log.debug ('scrollUp: ', scope.firstPage -1 > 0);
        //$log.debug ('scrollDown: ', scope.currentPage + 1 < scope.lastPage);

        self.scope.gridApi.infiniteScroll.dataLoaded(self.scope.firstPage - 1 > 0, self.scope.currentPage + 1 < self.scope.lastPage);
        self.scope.currentPage--;
    };

    this.filterChangedForScroll = function (grid) {
        $log.debug('this.grid', grid );
        $log.debug('filterChanged column', grid.columns);

        var sortOptions = [];

        _.each(grid.columns, function(value, index) {
            $log.debug('myvalue', value);
            var searchTerms = [];
            var isValid = true;

            var columnType = 'string';
            if (typeof grid.columns[index].colDef.type !== 'undefined') {
                columnType = grid.columns[index].colDef.type;
            }

            if (columnType === 'string') {
                searchTerms.push(grid.columns[index].filters[0].term);
            }

            if (columnType === 'date') {
                //determine if 2 filters was configured
                var filterCount = grid.columns[index].filters.length;

                if (filterCount === 1) {
                    searchTerms.push(grid.columns[index].filters[0].term);

                    //validate term entered is a valid date before requesting page
                    _.each(grid.columns[index].filters, function(filter) {
                        //$log.debug('filter', filter);
                        if (typeof filter.term !== 'undefined' && filter.term.trim() !== '') {
                            if (filter.term.match(/\d{4}\-\d{2}\-\d{2}/) === null ) {
                                isValid = false;
                            }
                        }
                    });
                } else if (filterCount > 1) {
                    //$log.debug('grid.columns[index].filters', grid.columns[index].filters);
                    //only allow 2 filters and ignore the rest if defined
                    searchTerms.push(grid.columns[index].filters[0].term);
                    searchTerms.push(grid.columns[index].filters[1].term);

                    //validate term entered is a valid date before requesting page
                    if ((typeof grid.columns[index].filters[0].term !== 'undefined') && (typeof grid.columns[index].filters[1].term !== 'undefined')) {
                        if (typeof grid.columns[index].filters[0].term !== 'undefined' && grid.columns[index].filters[0].term.trim() !== '') {
                            $log.debug('term 1 is defined and not empty');
                            if (grid.columns[index].filters[0].term.match(/\d{4}\-\d{2}\-\d{2}/) === null ) {
                                isValid = false;
                            }
                        }

                        if (typeof grid.columns[index].filters[1].term !== 'undefined' && grid.columns[index].filters[1].term.trim() !== '') {
                            if (grid.columns[index].filters[1].term.match(/\d{4}\-\d{2}\-\d{2}/) === null ) {
                                isValid = false;
                            }
                        }
                    } else

                    if (! ((typeof grid.columns[index].filters[0].term === 'undefined') && (typeof grid.columns[index].filters[1].term === 'undefined'))) {
                        isValid = false;
                    }
                }
            }

            sortOptions.push({
                field: grid.columns[index].field,
                search: searchTerms,
                type: columnType,
                isValid: isValid
            });
        });

        self.paginateParams.search = sortOptions;

        self.scope.firstPage = 1;
        self.scope.currentPage = 1;
        self.paginateParams.start = 0;

        $timeout(function() {
            self.scope.gridApi.infiniteScroll.resetScroll(self.scope.firstPage - 1 > 0, self.scope.currentPage + 1 < self.scope.lastPage);
        });

        //only make get page call if all filters are valid
        var isAllValid = true;
        _.each(sortOptions, function(sortOption) {
            $log.debug('sortOption', sortOption);
            if (sortOption.isValid === false) {
                isAllValid = false;
                return false;
            }
        });

        if (isAllValid === true) {
            self.getPage();
        }
    };

    this.rowSelectionChanged = function(row){
        var parentEntities = [];

        //add item parentEntities
        if (self.currentEntityType === 'dataset' || self.currentEntityType === 'datafile') {
            if (_.has(self.stateParams, 'investigationId')) {
                parentEntities.push({
                    entityId: parseInt(self.stateParams.investigationId),
                    entityType: 'investigation'
                });
            }

            if (_.has(self.stateParams, 'datasetId')) {
                parentEntities.push({
                    entityId: parseInt(self.stateParams.datasetId),
                    entityType: 'dataset'
                });
            }
        }

        if (row.isSelected === true) {
            Cart.addItem(self.facility.facilityName, self.currentEntityType, row.entity.id, row.entity.name, parentEntities);
        } else {
            Cart.removeItem(self.facility.facilityName, self.currentEntityType, row.entity.id);
        }
    };

    this.rowSelectionChangedBatch = function(rows){
        _.each(rows, function(row) {
            self.rowSelectionChangedForScroll(row);
        });

    };
}
