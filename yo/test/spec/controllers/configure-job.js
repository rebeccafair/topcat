'use strict';

describe('configure job controller', function () {
    
    var configureJobController, controller, scope, uibModal, mockJobTypes, mockCartItems, inputEntities, ijpServiceMock, icatServiceMock, tcServiceMock, uibModalInstanceMock;

    var facilityName = 'test';

    beforeEach(function() {
        module(function($provide) {
            $provide.constant('LANG', {});
            $provide.constant('APP_CONFIG', readJSON('test/mock/data/mock-config.json'));
            $provide.constant('mockJobTypes', readJSON('test/mock/data/mock-job-types.json'));
            $provide.constant('mockCartItems', readJSON('test/mock/data/mock-cart-items.json'));
        });
    });

    beforeEach(module('angularApp'));

    beforeEach(inject(function($controller,$rootScope, $q, $uibModal,  _mockJobTypes_, _mockCartItems_){

        controller = $controller;
        scope = $rootScope.$new();
        uibModal = $uibModal;
        mockJobTypes = _mockJobTypes_;
        mockCartItems = _mockCartItems_;

        ijpServiceMock = {
            submitJob : function(jobType, jobParameters) {
                var deferred = $q.defer();
                deferred.resolve({"jobId":1234});
                return deferred.promise;
            },
            getJobType : function(jobType) {
                var deferred = $q.defer();
                if (jobType === undefined) { deferred.resolve(_.map(mockJobTypes, 'name')); 
                } else { deferred.resolve(_.find(mockJobTypes, function(mockJobType) { return mockJobType.name === jobType; })); }
                return deferred.promise;
            }
        };

        icatServiceMock = {
            query: function(datasetTypeQuery) {
                var datasetIds = datasetTypeQuery.match(/select distinct dataset\.type\.name from Dataset dataset where dataset\.id in \(\'(\d+)\'(?:,\'(\d+)\')*\)/);
                var datasetTypes = [];
                if (_.includes(datasetIds, '1')) { datasetTypes.push("dataset type 1"); }
                if (_.includes(datasetIds, '2')) { datasetTypes.push("dataset type 2"); }

                var deferred = $q.defer();
                deferred.resolve(datasetTypes);
                return deferred.promise;
            }
        };

        tcServiceMock = {
            ijp: function(facilityName){
                return ijpServiceMock;
            },
            icat: function(facilityName){
                return icatServiceMock;
            }
        };

        uibModalInstanceMock = {
            open: function(){},
            close: function(){}
        }

    }));
    
    describe('submitJob(submitMultipleJobs)', function(){
        beforeEach(function(){
            configureJobController = controller('ConfigureJobController', { 
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: mockCartItems,
                facilityName: facilityName,
                $uibModal: uibModal,
                $uibModalInstance: uibModalInstanceMock
            });
            scope.$apply();
        });

        it('should submit a single job when submitJob(false)', function(){
            spyOn(ijpServiceMock, 'submitJob').and.callThrough();
            configureJobController.submitJob(false);
            expect(ijpServiceMock.submitJob.calls.count()).toEqual(1);
        });

        it('should submit jobs equal to the number of input entities when submitJob(true)', function(){
            spyOn(ijpServiceMock, 'submitJob').and.callThrough();
            configureJobController.submitJob(true);
            expect(ijpServiceMock.submitJob.calls.count()).toEqual(mockCartItems.length);
        });

        it('should submit a single job with correct parameters when submitJob(false)', function(){
            spyOn(ijpServiceMock, 'submitJob').and.callThrough();
            configureJobController.selectedJobType.jobOptions[2].value = "--mode=verbose";
            configureJobController.selectedJobType.jobOptions[3].value = true;
            configureJobController.selectedJobType.jobOptions[4].value = "beads beads-fullframe";
            configureJobController.submitJob(false);
            expect(ijpServiceMock.submitJob).toHaveBeenCalledWith('Test Options',['--datasetIds=1,2','--datafileIds=3','--option-two','Default for option 2','--mode=verbose','--silent=true','--viewtype','beads beads-fullframe','--index', 1,'--origin',0]);
        });

        it('should submit multiple jobs, each with correct parameters when submitJob(true)', function(){
            spyOn(ijpServiceMock, 'submitJob').and.callThrough();
            configureJobController.selectedJobType.jobOptions[2].value = "--mode=effusive";
            configureJobController.selectedJobType.jobOptions[3].value = false;
            configureJobController.selectedJobType.jobOptions[4].value = "";
            configureJobController.submitJob(true);
            expect(ijpServiceMock.submitJob.calls.argsFor(0)).toEqual(['Test Options',['--datasetIds=1','--option-two','Default for option 2','--mode=effusive','--index', 1,'--origin',0]]);
            expect(ijpServiceMock.submitJob.calls.argsFor(1)).toEqual(['Test Options',['--datasetIds=2','--option-two','Default for option 2','--mode=effusive','--index', 1,'--origin',0]]);
            expect(ijpServiceMock.submitJob.calls.argsFor(2)).toEqual(['Test Options',['--datafileIds=3','--option-two','Default for option 2','--mode=effusive','--index', 1,'--origin',0]]);
        });

        it('should open a modal', function(){
            spyOn(uibModal, 'open').and.callThrough();
            configureJobController.submitJob(false);
            expect(uibModal.open).toHaveBeenCalled();
        })


    });

    describe('getCompatibleJobTypes()', function(){
        it('should get the correct compatible job types when given 2 datasets and 1 datafile', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: mockCartItems,
                facilityName: facilityName,
                $uibModal: uibModal,
                $uibModalInstance: uibModalInstanceMock
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - multiple datasets or datafiles','Test args - single dataset or datafile','Interactive job - multiple datasets or files']);
        })

        it('should get the correct compatible job types when given 1 dataset of dataset type "dataset type 1"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [mockCartItems[0]],
                facilityName: facilityName,
                $uibModal: uibModal,
                $uibModalInstance: uibModalInstanceMock
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - datasets only','Test args - multiple datasets or datafiles','Test args - single dataset or datafile','Test args - dataset type 1 only','Interactive job - multiple datasets or files','Interactive job - single dataset or file']);
        })

        it('should get the correct compatible job types when given 1 datafile"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [mockCartItems[2]],
                facilityName: facilityName,
                $uibModal: uibModal,
                $uibModalInstance: uibModalInstanceMock
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - datafiles only','Test args - multiple datasets or datafiles','Test args - single dataset or datafile','Interactive job - multiple datasets or files','Interactive job - single dataset or file']);
        })

        it('should get the correct compatible job types when given no input entities"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [],
                facilityName: facilityName,
                $uibModal: uibModal,
                $uibModalInstance: uibModalInstanceMock
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Create datafile','Sleepcount']);
        })


    });

});