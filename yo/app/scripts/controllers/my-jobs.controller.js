
(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('MyJobsController', function($translate, $q, $scope, $rootScope, $timeout, $templateCache, $state, $uibModal, tc, helpers, uiGridConstants){

        var that = this;
        var pagingConfig = tc.config().paging;
        var isScroll = pagingConfig.pagingType == 'scroll';
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var page = 1;
        var gridApi;
        var canceler = $q.defer();
        var facility = tc.facility($state.params.facilityName);
        var facilityName = $state.params.facilityName;

        this.ijpFacilities = tc.ijpFacilities();
        console.log(this.ijpFacilities);

        if($state.params.facilityName == ''){
          $state.go('home.my-jobs', {facilityName: this.ijpFacilities[0].config().facilityName});
          return;
        }

        var gridOptions = _.merge({
            data: [],
            appScopeProvider: this
        }, facility.config().myJobs.gridOptions);


        setUpGridOptions();
        this.gridOptions = gridOptions;
        this.isScroll = isScroll;

        function setUpGridOptions(){

            gridOptions.enableHorizontalScrollbar = uiGridConstants.scrollbars.NEVER;
            gridOptions.enableRowSelection =  false;
            gridOptions.enableRowHeaderSelection =  false;
            gridOptions.gridMenuShowHideColumns =  false;
            gridOptions.pageSize =  !that.isScroll ? pagingConfig.paginationNumberOfRows : null;
            gridOptions.paginationPageSizes =  pagingConfig.paginationPageSizes;
            gridOptions.paginationNumberOfRows =  pagingConfig.paginationNumberOfRows;
            gridOptions.enableFiltering = true;
            gridOptions.rowTemplate = '<div ng-click="grid.appScope.showJobDetails(row)" ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }" ui-grid-cell></div>';

            _.each(gridOptions.columnDefs, function(columnDef){
                columnDef.enableHiding = false;

                if(columnDef.field == 'date'){
                    columnDef.filters = [
                        {
                            "condition": function(filterDate, cellDate) {
                                if (filterDate == "") return true;
                                return new Date(cellDate.replace(/\s.*$/,'')) >= new Date(filterDate.replace(/\\/g,''));
                            },
                            "placeholder": "From..."
                        },
                        {
                            "condition": function(filterDate, cellDate) {
                                if (filterDate == "") return true;
                                return new Date(cellDate.replace(/\s.*$/,'')) <= new Date(filterDate.replace(/\\/g,''));
                            },
                            "placeholder": "To..."
                        }
                    ];
                    columnDef.filterHeaderTemplate = '<div class="ui-grid-filter-container" datetime-picker only-date ng-model="col.filters[0].term" placeholder="From..."></div><div class="ui-grid-filter-container" datetime-picker only-date ng-model="col.filters[1].term" placeholder="To..."></div>';
                    columnDef.sort = {
                        direction: uiGridConstants.DESC
                    };
                } else {
                    columnDef.filter = {
                        "condition": uiGridConstants.filter.CONTAINS,
                        "placeholder": "Containing...",
                        "type": "input"
                    };
                }

                columnDef.displayName = "MY_JOBS.COLUMN." + helpers.constantify(columnDef.field);
                columnDef.headerCellFilter = 'translate';

            });

        }

        function getJobs() {
            that.isLoading = true;
            return tc.ijp(facilityName).getJob().then(function(results){
                that.isLoading = false;
                return results;
            });
        }

        this.showJobDetails = function (row) {
            var modal = $uibModal.open({
                templateUrl : 'views/job-details.html',
                windowClass : 'job-details',
                controller: 'JobDetailsController as jobDetailsController',
                resolve: {
                    jobId : function() {
                        return row.entity.jobId;
                    }
                }
            });
        }

        gridOptions.onRegisterApi = function(_gridApi) {
            gridApi = _gridApi;

            getJobs().then(function(results){
                gridOptions.data = results;
            });

        };