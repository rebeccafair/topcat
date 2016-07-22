'use strict';

describe('my jobs controller', function () {
    
    var myJobsController, controller, scope, $q, interval, uibModal, httpBackend, mockJobs, mockCartItems,  ijpFacilityMock, ijpFacilityUserMock, ijpServiceMock, tcServiceMock;

    var facilityName = 'test';

    beforeEach(function() {
        module(function($provide) {
            $provide.constant('LANG', {});
            $provide.constant('APP_CONFIG', readJSON('test/mock/data/mock-config.json'));
            $provide.constant('mockJobs', readJSON('test/mock/data/mock-jobs.json'));
            $provide.constant('mockCartItems', readJSON('test/mock/data/mock-cart-items.json'));
        });
    });

    beforeEach(module('angularApp'));

    beforeEach(inject(function($controller, $rootScope, _$q_, $interval, $uibModal, $httpBackend, _mockJobs_, _mockCartItems_, APP_CONFIG){

        controller = $controller;
        scope = $rootScope.$new();
        $q = _$q_;
        interval = $interval;
        uibModal = $uibModal;
        httpBackend = $httpBackend;
        mockJobs = _mockJobs_;
        mockCartItems = _mockCartItems_;

        ijpFacilityMock = {
            user: function() {
                return ijpFacilityUserMock;
            }
        };

        ijpFacilityUserMock = {
            cart: function() {
                var deferred = $q.defer();
                deferred.resolve({ "cartItems": mockCartItems });
                return deferred.promise;
            }
        };

        ijpServiceMock = {
            getJob: function() {
                var deferred = $q.defer();
                deferred.resolve(mockJobs);
                return deferred.promise;
            },
            getJobOutput: function(jobId) {
                var deferred = $q.defer();
                deferred.resolve({"output":"Job output"});
                return deferred.promise;
            },
            getErrorOutput: function(jobId) {
                var deferred = $q.defer();
                deferred.resolve({"output":"Error output"});
                return deferred.promise;
            },
            deleteJob: function(jobId) {
                var deferred = $q.defer();
                deferred.resolve();
                return deferred.promise;
            },
            cancelJob: function(jobId) {
                var deferred = $q.defer();
                deferred.resolve();
                return deferred.promise;
            }

        };

        tcServiceMock = {
            ijp: function(facilityName){
                return ijpServiceMock;
            },
            ijpFacilities() {
                return [ijpFacilityMock];
            },
            config: function(){
                return APP_CONFIG.site;
            }
        };

        spyOn(ijpServiceMock, 'getJob').and.callThrough();

        myJobsController = controller('MyJobsController', { 
            $scope: scope,
            tc: tcServiceMock,
            $uibModal: uibModal
        });
        scope.$apply();

    }));

    describe('initialisation', function(){

        it('should put jobs in the ui grid data', function(){
            expect(myJobsController.gridOptions.data).toEqual(mockJobs);
        });

        it('should refresh jobs on initialisation', function(){
            expect(ijpServiceMock.getJob.calls.count()).toEqual(1);
        });

        it('should set a timer to refresh jobs', function(){
            ijpServiceMock.getJob.calls.reset();
            interval.flush(30001);
            expect(ijpServiceMock.getJob.calls.count()).toEqual(1);
            interval.flush(30000);
            expect(ijpServiceMock.getJob.calls.count()).toEqual(2);
        });

        it('should refresh jobs when a job is submitted', function(){
            ijpServiceMock.getJob.calls.reset();
            scope.$emit('jobSubmitted');
            expect(ijpServiceMock.getJob.calls.count()).toEqual(1);
        });

        it('should stop refreshing jobs when controller is destroyed', function(){
            ijpServiceMock.getJob.calls.reset();
            scope.$emit('$destroy');
            interval.flush(300001);
            expect(ijpServiceMock.getJob.calls.count()).toEqual(0);
        });

    });

    describe('showJobDetailsModal(job)', function(){

        beforeEach(function(){
            spyOn(ijpServiceMock, 'getJobOutput').and.callThrough();
            spyOn(ijpServiceMock, 'getErrorOutput').and.callThrough();
            httpBackend.expectGET('views/job-details-modal.html').respond("");
        })

        it('should open a job details modal', function() {
            myJobsController.showJobDetailsModal(mockJobs[0]);
            expect(myJobsController.jobDetailsModal).not.toEqual(undefined);
        })


        it('should get the job and error output when the modal is opened', function(){
            myJobsController.showJobDetailsModal(mockJobs[0]);
            expect(ijpServiceMock.getJobOutput).toHaveBeenCalled();
            expect(ijpServiceMock.getErrorOutput).toHaveBeenCalled();
        });

        it('should get the job and error output for the correct job id', function(){
            myJobsController.showJobDetailsModal(mockJobs[0]);
            expect(ijpServiceMock.getJobOutput).toHaveBeenCalledWith('1234');
            expect(ijpServiceMock.getErrorOutput).toHaveBeenCalledWith('1234');
        })

        it('should set a timer to refresh the job output if the job is executing', function(){
            myJobsController.showJobDetailsModal(mockJobs[0]);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(1);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(1);
        });

        it('should set a timer to refresh the job output if the job is queued', function(){
            myJobsController.showJobDetailsModal(mockJobs[1]);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(1);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(1);
        });

        it('should not set a timer to refresh the job output, if the job is completed', function(){
            myJobsController.showJobDetailsModal(mockJobs[2]);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(0);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(0);
        });

        it('should not set a timer to refresh the job output, if the job is cancelled', function(){
            myJobsController.showJobDetailsModal(mockJobs[3]);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(0);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(0);
        });

        it('should stop refreshing the output if the job status changes to Completed/Cancelled', function(){
            myJobsController.showJobDetailsModal(mockJobs[0]);
            mockJobs[0].status = "Completed";
            interval.flush(300001);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(0);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(0);
        });

        it('should stop refreshing the output if the modal is closed', function(){
            myJobsController.showJobDetailsModal(mockJobs[0]);
            httpBackend.flush();
            myJobsController.close(myJobsController.jobDetailsModal);

            interval.flush(5001);
            ijpServiceMock.getJobOutput.calls.reset();
            ijpServiceMock.getErrorOutput.calls.reset();
            interval.flush(5001);
            expect(ijpServiceMock.getJobOutput.calls.count()).toEqual(0);
            expect(ijpServiceMock.getErrorOutput.calls.count()).toEqual(0);
        });

    });

    describe('close()', function(){

        it('should close the job details modal', function(){;
            httpBackend.expectGET('views/job-details-modal.html').respond("");
            myJobsController.jobDetailsModal = uibModal.open({ templateUrl : 'views/job-details.html'});
            spyOn(myJobsController.jobDetailsModal, 'close').and.callThrough();
            myJobsController.close(myJobsController.jobDetailsModal);
            expect(myJobsController.jobDetailsModal.close).toHaveBeenCalled();
        });

        it('should close the job inputs modal', function(){
            httpBackend.expectGET('views/choose-job-inputs-modal.html').respond("");
            myJobsController.chooseJobInputsModal = uibModal.open({ templateUrl : 'views/choose-job-inputs-modal.html'});
            spyOn(myJobsController.chooseJobInputsModal, 'close').and.callThrough();
            myJobsController.close(myJobsController.chooseJobInputsModal);
            expect(myJobsController.chooseJobInputsModal.close).toHaveBeenCalled();
        });
    });

    describe('deleteJob()', function(){

        var event = {
            stopPropagation: function(){}
        };

        it('should delete a job', function(){
            spyOn(ijpServiceMock, 'deleteJob').and.callThrough();
            myJobsController.deleteJob(event, mockJobs[2]);
            expect(ijpServiceMock.deleteJob).toHaveBeenCalled();
        });

        it('should delete a job with the correct job id', function(){
            spyOn(ijpServiceMock, 'deleteJob').and.callThrough();
            myJobsController.deleteJob(event, mockJobs[2]);
            expect(ijpServiceMock.deleteJob).toHaveBeenCalledWith('1236');
        });

        it('should refresh the jobs', function(){
            ijpServiceMock.getJob.calls.reset();
            myJobsController.deleteJob(event, mockJobs[2]);
            scope.$apply();
            expect(ijpServiceMock.getJob).toHaveBeenCalled();
        });
    });

    describe('cancelJob()', function(){

        var event = {
            stopPropagation: function(){}
        };

        it('should cancel a job', function(){
            spyOn(ijpServiceMock, 'cancelJob').and.callThrough();
            myJobsController.cancelJob(event, mockJobs[0]);
            expect(ijpServiceMock.cancelJob).toHaveBeenCalled();
        });

        it('should cancel a job with the correct job id', function(){
            spyOn(ijpServiceMock, 'cancelJob').and.callThrough();
            myJobsController.cancelJob(event, mockJobs[0]);
            expect(ijpServiceMock.cancelJob).toHaveBeenCalledWith('1234');
        });

        it('should refresh the jobs', function(){
            ijpServiceMock.getJob.calls.reset();
            myJobsController.cancelJob(event, mockJobs[0]);
            scope.$apply();
            expect(ijpServiceMock.getJob).toHaveBeenCalled();
        });
    });

    describe('configureJob()', function(){

        it('should open a choose job inputs modal if there is more than one item in the cart', function(){
            spyOn(ijpFacilityUserMock, 'cart').and.callThrough();
            httpBackend.expectGET('views/choose-job-inputs-modal.html').respond("");
            myJobsController.configureJob(ijpFacilityMock);
            scope.$apply();
            expect(myJobsController.chooseJobInputsModal).not.toEqual(undefined);

        });

        it('should open a configure job modal if there are no items in the cart', function(){
            spyOn(ijpFacilityUserMock, 'cart').and.callFake(function(){
                var deferred = $q.defer();
                deferred.resolve({ "cartItems": [] });
                return deferred.promise;
            });
            spyOn(myJobsController, 'openConfigureJobModal')
            myJobsController.configureJob(ijpFacilityMock);
            scope.$apply();
            expect(myJobsController.openConfigureJobModal).toHaveBeenCalled();

        });
    });

});