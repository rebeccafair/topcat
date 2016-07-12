
(function(){
    'use strict';

    var app = angular.module('angularApp');

    app.controller('MyJobsController', function($rootScope, $q, $scope, $state, $uibModal, tc, helpers, uiGridConstants){

        var that = this;
        var pagingConfig = tc.config().paging;
        var isScroll = pagingConfig.pagingType == 'scroll';
        var pageSize = isScroll ? pagingConfig.scrollPageSize : pagingConfig.paginationNumberOfRows;
        var page = 1;
        var gridApi;
        var facility = tc.facility($state.params.facilityName);
        var facilityName = $state.params.facilityName;

        this.ijpFacilities = tc.ijpFacilities();
        this.ijpFacility = this.ijpFacilities[0];

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

        this.showJobDetailsModal = function(job){
            that.selectedJob = job;
            that.standardOutput = "";
            that.errorOutput = "";
            that.isLoadingStandardOutput = true;

            refreshJobOutput();

            var jobDetailsModal = $uibModal.open({
                templateUrl : 'views/job-details.html',
                size: 'lg',
                scope: $scope
            });

            //Doesn't refresh job output if job is already completed or cancelled
            if (!job.status.match(/Completed|Cancelled/)){

                var refreshJobOutputInterval = window.setInterval(refreshJobOutput, 1000 * 5);
                //Checks to see if the job is completed yet or has been cancelled, and stops refreshing job output if true
                var checkJobStatusInterval = window.setInterval(function(){
                    if (_.find(gridOptions.data, function(j){ return j.jobId === job.jobId }).status.match(/Completed|Cancelled/)) {
                        window.clearInterval(refreshJobOutputInterval);
                        window.clearInterval(checkJobStatusInterval);
                    }
                }, 1000 * 5);

                jobDetailsModal.result.finally(function(){
                    window.clearInterval(refreshJobOutputInterval);
                    window.clearInterval(checkJobStatusInterval);
                });
            }
        };

        this.configureJob = function(ijpFacility){
            that.ijpFacility = ijpFacility;
            ijpFacility.user().cart().then(function(cart){
                that.cartItems = cart.cartItems
                if(that.cartItems.length > 0) {
                    that.chooseInputModal = $uibModal.open({
                        templateUrl : 'views/choose-job-inputs-modal.html',
                        size : 'med',
                        scope: $scope
                    });
                } else {
                    that.openConfigureJobModal([]);
                }
            })
        };

        this.openConfigureJobModal = function(jobInputs) {
            if(this.chooseInputModal) { this.chooseInputModal.close() }
            $uibModal.open({
                templateUrl : 'views/configure-job.html',
                controller: "ConfigureJobController as configureJobController",
                size : 'lg',
                resolve: {
                    inputEntities: function() { return jobInputs },
                    facilityName: function() { return that.ijpFacility.config().facilityName }
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

        this.cancelJob = function(clickEvent, job){
            clickEvent.stopPropagation();
            tc.ijp(facilityName).cancelJob(String(job.jobId)).finally(function(){
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
            gridOptions.rowTemplate = '<div ng-click="grid.appScope.showJobDetailsModal(row.entity)" ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" class="ui-grid-cell" ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }" ui-grid-cell></div>';

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
            actionButtons += '<button ng-if="row.entity.status === \'Completed\' || row.entity.status === \'Cancelled\'" class="btn btn-danger btn-xs" translate="MY_JOBS.COLUMN.ACTIONS.BUTTON.DELETE_JOB.TEXT" uib-tooltip="{{\'MY_JOBS.COLUMN.ACTIONS.BUTTON.DELETE_JOB.TOOLTIP.TEXT\' | translate}}" tooltip-placement="right" tooltip-append-to-body="true" ng-click="grid.appScope.deleteJob($event, row.entity)" ng-style="{ \'margin-right\':\'3px\' }"></button>';
            actionButtons += '<button ng-if="row.entity.status === \'Queued\' || row.entity.status === \'Executing\'" class="btn btn-warning btn-xs" translate="MY_JOBS.COLUMN.ACTIONS.BUTTON.CANCEL_JOB.TEXT" uib-tooltip="{{\'MY_JOBS.COLUMN.ACTIONS.BUTTON.CANCEL_JOB.TOOLTIP.TEXT\' | translate}}" tooltip-placement="right" tooltip-append-to-body="true" ng-click="grid.appScope.cancelJob($event, row.entity)" ng-style="{ \'margin-right\':\'3px\' }"></button>';
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
            tc.ijp(facilityName).getJobOutput(String(that.selectedJob.jobId)).then(function(standardOutput){
                that.standardOutput = standardOutput.output.replace(/\n/g,"<br />");
            }).finally(function(){
                that.isLoadingStandardOutput = false;
            });
        };

        function getErrorOutput() {
            tc.ijp(facilityName).getErrorOutput(String(that.selectedJob.jobId)).then(function(errorOutput){
                that.errorOutput = errorOutput.output.replace(/\n/g,"<br />");
            });
        };

        function refresh() {
            getJobs().then(function(results){
                gridOptions.data = results;
            });
        }

        function refreshJobOutput() {
            getStandardOutput();
            getErrorOutput();
        }

        gridOptions.onRegisterApi = function(_gridApi) {
            gridApi = _gridApi;

            refresh();

            $rootScope.$on('jobSubmitted', refresh);

            var refreshInterval = window.setInterval(refresh, 1000 * 30);

            $scope.$on('$destroy', function(){
                window.clearInterval(refreshInterval);
            });

        };

    });

})();