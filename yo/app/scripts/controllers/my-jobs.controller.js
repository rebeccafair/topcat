
(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('MyJobsController', function($q, $scope, $rootScope, $templateCache, $state, $uibModal, tc, helpers, uiGridConstants){

        var that = this;
        var pagingConfig = tc.config().paging;
        var isScroll = pagingConfig.pagingType == 'scroll';
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var page = 1;
        var gridApi;
        var facility = tc.facility($state.params.facilityName);
        var facilityName = $state.params.facilityName;
        var selectedJobId;

        this.isLoadingStandardOutput = true;
        this.ijpFacilities = tc.ijpFacilities();

        if($state.params.facilityName == ''){
            if (this.ijpFacilities.length > 0) {
                $state.go('home.my-jobs', {facilityName: this.ijpFacilities[0].config().facilityName});
            }
            return;
        }

        var gridOptions = _.merge({
            data: [],
            appScopeProvider: this
            }, {
            "enableFiltering": true,
                "columnDefs": [
                    {
                        "field": "jobId"
                    },
                    {
                        "field": "name"
                    },
                    {
                        "field": "date"
                    },
                    {
                        "field": "status"
                    }
                ]
            });

        setUpGridOptions();
        this.gridOptions = gridOptions;
        this.isScroll = isScroll;

        this.showJobDetailsModal = function(row){
            that.selectedJobId = String(row.entity.jobId);
            that.standardOutput = "";
            that.errorOutput = "";
            that.isLoadingStandardOutput = true;
            getStandardOutput();
            getErrorOutput();
            $uibModal.open({
                templateUrl : 'views/job-details.html',
                size: 'lg',
                scope: $scope
            });
        };

        this.configureJob = function(){
            this.ijpFacilities[0].user().cart().then(function(cart){
                that.cartItems = cart.cartItems
                if(that.cartItems.length > 0) {
                    that.chooseInputModal = $uibModal.open({
                        templateUrl : 'views/choose-job-inputs-modal.html',
                        size : 'med',
                        scope: $scope
                    });
                } else {
                    that.configureWithNoInputs();
                }


            })
        };

        this.configureWithNoInputs = function(){
            if(this.chooseInputModal) { this.chooseInputModal.close() }
            $uibModal.open({
                templateUrl : 'views/configure-job.html',
                controller: "ConfigureJobController as configureJobController",
                size : 'lg',
                resolve: {
                    inputEntities: function() { return [] },
                    facilityName: function() { return facilityName }
                }
            });
        }

        this.configureWithCartInputs = function(){
            if(this.chooseInputModal) { this.chooseInputModal.close() }
            $uibModal.open({
                templateUrl : 'views/configure-job.html',
                controller: "ConfigureJobController as configureJobController",
                size : 'lg',
                resolve: {
                    inputEntities: function() { return that.cartItems },
                    facilityName: function() { return facilityName }
                }
            });

        }

        this.close = function(thisModal){
            thisModal.$parent.$close();
        }

        this.deleteJob = function(clickEvent, job){
            clickEvent.stopPropagation();
            tc.ijp(facilityName).deleteJob(String(job.jobId)).finally(function(){
                refresh();
            });
        }

        function setUpGridOptions(){

            gridOptions.enableHorizontalScrollbar = uiGridConstants.scrollbars.NEVER;
            gridOptions.enableRowSelection =  false;
            gridOptions.enableRowHeaderSelection =  false;
            gridOptions.gridMenuShowHideColumns =  false;
            gridOptions.pageSize =  !that.isScroll ? pagingConfig.paginationNumberOfRows : null;
            gridOptions.paginationPageSizes =  pagingConfig.paginationPageSizes;
            gridOptions.paginationNumberOfRows =  pagingConfig.paginationNumberOfRows;
            gridOptions.enableFiltering = true;
            gridOptions.rowTemplate = '<div ng-click="grid.appScope.showJobDetailsModal(row)" ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }" ui-grid-cell></div>';

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

            var actionButtons = '';
            actionButtons += '<button ng-if="row.entity.status === (\'Completed\' || \'Cancelled\')" class="btn btn-danger btn-xs" translate="MY_JOBS.COLUMN.ACTIONS.BUTTON.DELETE_JOB.TEXT" uib-tooltip="{{\'MY_JOBS.COLUMN.ACTIONS.BUTTON.DELETE_JOB.TOOLTIP.TEXT\' | translate}}" tooltip-placement="right" tooltip-append-to-body="true" ng-click="grid.appScope.deleteJob($event, row.entity)" ng-style="{ \'margin-right\':\'3px\' }"></button>';
            gridOptions.columnDefs.push({
                name : 'actions',
                visible: true,
                title: 'MY_JOBS.COLUMN.ACTIONS.NAME',
                enableFiltering: false,
                enable: false,
                enableColumnMenu: false,
                enableSorting: false,
                enableHiding: false,
                cellTemplate : '<div class="ui-grid-cell-contents">' + actionButtons + '</div>'
            });

        }

        function getJobs() {
            that.isLoading = true;
            return tc.ijp(facilityName).getJob().then(function(results){
                that.isLoading = false;
                return results;
            });
        }

        function getStandardOutput() {
            tc.ijp(facilityName).getJobOutput(that.selectedJobId).then(function(standardOutput){
                that.standardOutput = standardOutput.output.replace(/\n/g,"<br />");
            }).finally(function(){
                that.isLoadingStandardOutput = false;
            });
        };

        function getErrorOutput() {
            tc.ijp(facilityName).getErrorOutput(that.selectedJobId).then(function(errorOutput){
                that.errorOutput = errorOutput.output.replace(/\n/g,"<br />");
            });
        };

        function refresh() {
            getJobs().then(function(results){
                gridOptions.data = results;
            });
        }

        gridOptions.onRegisterApi = function(_gridApi) {
            gridApi = _gridApi;

            getJobs().then(function(results){
                gridOptions.data = results;
            });

        };

    });

})();