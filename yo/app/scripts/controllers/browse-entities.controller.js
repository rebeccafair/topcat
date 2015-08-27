(function() {
    'use strict';

    /*jshint -W083 */
    angular
        .module('angularApp')
        .controller('BrowseEntitiesController', BrowseEntitiesController);

    BrowseEntitiesController.$inject = ['$rootScope', '$scope', '$state', '$stateParams', '$filter', '$compile', 'APP_CONFIG', 'Config', '$translate', 'ConfigUtils', 'RouteService', 'DataManager', '$q', 'inform', '$sessionStorage', 'BrowseEntitiesModel', 'uiGridConstants', '$log'];

    function BrowseEntitiesController($rootScope, $scope, $state, $stateParams, $filter, $compile, APP_CONFIG, Config, $translate, ConfigUtils, RouteService, DataManager, $q, inform, $sessionStorage, BrowseEntitiesModel, uiGridConstants, $log) { //jshint ignore: line
        var facilityName = $stateParams.facilityName;
        var pagingType = Config.getSitePagingType(APP_CONFIG); //the pagination type. 'scroll' or 'page'
        var currentEntityType = RouteService.getCurrentEntityType($state); //possible options: facility, cycle, instrument, investigation dataset, datafile
        var facility = Config.getFacilityByName(APP_CONFIG, facilityName);
        var currentRouteSegment = RouteService.getCurrentRouteSegmentName($state);
        var sessions = $sessionStorage.sessions;

        $scope.currentEntityType = currentEntityType;
        $scope.isScroll = (pagingType === 'scroll') ? true : false;

        $scope.isEmpty = false;

        $scope.gridOptions = {
            appScopeProvider: $scope
        };

        BrowseEntitiesModel.init(facility, $scope, currentEntityType, currentRouteSegment, sessions, $stateParams, $scope.gridOptions);

        if (pagingType === 'page') {
            $scope.gridOptions.onRegisterApi = function(gridApi) {
                $scope.gridApi = gridApi;

                //sort callback
                $scope.gridApi.core.on.sortChanged($scope, function(grid, sortColumns) {
                    BrowseEntitiesModel.sortChangedForPage(grid, sortColumns);
                });

                //pagination callback
                $scope.gridApi.pagination.on.paginationChanged($scope, function(newPage, pageSize) {
                    BrowseEntitiesModel.paginationChangedForPage(newPage, pageSize);
                });

                $scope.gridApi.core.on.filterChanged($scope, function() {
                    BrowseEntitiesModel.filterChangedForPage(this.grid);
                });

                $scope.gridApi.selection.on.rowSelectionChanged($scope, function(row) {
                    BrowseEntitiesModel.rowSelectionChanged(row);
                });

                $scope.gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows) {
                    BrowseEntitiesModel.rowSelectionChangedBatch(rows);
                });
            };

            BrowseEntitiesModel.getPage();
        } else {
            $scope.firstPage = 1;
            $scope.lastPage = null;
            $scope.currentPage = 1;

            $scope.gridOptions.onRegisterApi = function(gridApi) {
                $log.debug('onRegisterApi called', gridApi);

                $scope.gridApi = gridApi;

                //sort callback
                $scope.gridApi.core.on.sortChanged($scope, function(grid, sortColumns) {
                    BrowseEntitiesModel.sortChangedForScroll(grid, sortColumns);
                });

                $scope.gridApi.infiniteScroll.on.needLoadMoreData($scope, function() {
                    BrowseEntitiesModel.needLoadMoreDataForScroll();
                });

                $scope.gridApi.infiniteScroll.on.needLoadMoreDataTop($scope, function() {
                    BrowseEntitiesModel.needLoadMoreDataTopForScroll();
                });

                $scope.gridApi.core.on.filterChanged($scope, function () {
                    BrowseEntitiesModel.filterChangedForScroll(this.grid);
                });

                $scope.gridApi.selection.on.rowSelectionChanged($scope, function(row){
                    BrowseEntitiesModel.rowSelectionChanged(row);
                });

                $scope.gridApi.selection.on.rowSelectionChangedBatch ($scope, function(rows){
                    BrowseEntitiesModel.rowSelectionChangedBatch(rows);
                });
            };

            BrowseEntitiesModel.getPage();
        }


        $rootScope.$on('Cart:itemRemoved', function(){
            BrowseEntitiesModel.refreshSelection($scope);
        });


        /**
         * Function required by view expression to get the next route segment
         *
         * Note: we have to use $scope here rather than vm (AS syntax) to make it work
         * with ui-grid cellTemplate grid.appScope
         *
         * @return {[type]}     [description]
         */
        $scope.getNextRouteUrl = function(row) {
            return BrowseEntitiesModel.getNextRouteUrl(row);
        };

        $scope.showTabs = function(row) {
            var data = {'type' : currentEntityType, 'id' : row.entity.id, facilityName: facilityName};
            $rootScope.$broadcast('rowclick', data);
        };
    }
})();