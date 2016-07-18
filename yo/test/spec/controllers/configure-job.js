'use strict';

describe('configure job controller', function () {
    
    var controller, configureJobController, inputEntities, scope, tcServiceMock, ijpServiceMock, icatServiceMock, mockJobTypes, mockInputEntities, mockModal;

    var facilityName = 'test';

    beforeEach(function() {
        module(function($provide) {
            $provide.constant('LANG', {});
            $provide.constant('APP_CONFIG', readJSON('app/config/topcat_dev.json'));
            $provide.constant('mockJobTypes', readJSON('test/mock/data/job-types.json'));
            $provide.constant('mockInputEntities', readJSON('test/mock/data/job-input-entities.json'));
        });
    });

    beforeEach(module('angularApp'));

    beforeEach(inject(function($controller,$rootScope, $q, _mockJobTypes_, _mockInputEntities_){

        controller = $controller;
        scope = $rootScope.$new();
        mockJobTypes = _mockJobTypes_;
        mockInputEntities = _mockInputEntities_;

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

        mockModal = {
            open: function() {},
            close: function() {}
        };

    }));
    
    describe('submitJob(submitMultipleJobs)', function(){
        beforeEach(function(){
            configureJobController = controller('ConfigureJobController', { 
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: mockInputEntities, 
                facilityName: facilityName,
                $uibModal: mockModal
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
            expect(ijpServiceMock.submitJob.calls.count()).toEqual(mockInputEntities.length);
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
            spyOn(mockModal, 'open');
            configureJobController.submitJob(false);
            expect(mockModal.open).toHaveBeenCalled();
        })


    });

    describe('getCompatibleJobTypes()', function(){
        it('should get the correct compatible job types when given 2 datasets and 1 datafile', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: mockInputEntities, 
                facilityName: facilityName,
                $uibModal: mockModal
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - multiple datasets or datafiles','Test args - single dataset or datafile']);
        })

        it('should get the correct compatible job types when given 1 dataset of dataset type "dataset type 1"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [mockInputEntities[0]], 
                facilityName: facilityName,
                $uibModal: mockModal
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - datasets only','Test args - multiple datasets or datafiles','Test args - single dataset or datafile','Test args - dataset type 1 only']);
        })

        it('should get the correct compatible job types when given 1 datafile"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [mockInputEntities[2]], 
                facilityName: facilityName,
                $uibModal: mockModal
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Test Options','Test args - datafiles only','Test args - multiple datasets or datafiles','Test args - single dataset or datafile']);
        })

        it('should get the correct compatible job types when given no input entities"', function(){
            configureJobController = controller('ConfigureJobController', {
                $scope: scope,
                tc: tcServiceMock,
                inputEntities: [], 
                facilityName: facilityName,
                $uibModal: mockModal
            });
            scope.$apply();
            expect(_.map(configureJobController.compatibleJobTypes, 'name')).toEqual(['Create datafile','Sleepcount']);
        })


    });

});