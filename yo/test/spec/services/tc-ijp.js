'use strict';

describe('tc ijp service', function () {
    
    var ijpService, ijpServer;

    beforeEach(function() {
        module(function($provide) {
            $provide.constant('LANG', {});
            $provide.constant('APP_CONFIG', readJSON('test/mock/data/config.json'));
        });
    });

    beforeEach(module('angularApp'));

    beforeEach(inject(function($httpBackend, tc){
        ijpService = tc.ijp('test');
        ijpServer = $httpBackend;
    }));
    

    describe('getJobType()', function () {
        it('should fetch a list of job type names', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/jobtype').respond(["Test args - datafiles only","Test args - datasets only","sleepcount (Scarf)","Sleepcount","Test Options","Test args - single dataset or datafile","Date","Copy datafile","Create datafile","Test args - multiple datasets or datafiles"]);
            ijpService.getJobType();
            ijpServer.flush();
        });
        it('should fetch a specific job type', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/jobtype/Test Options').respond({"name":"Test Options","executable":"test_args.py","multiple":true,"type":"batch","acceptsDatasets":true,"acceptsDatafiles":true,"sessionIdRequired":true,"icatUrlRequired":true,"idsUrlRequired":true,"datasetTypes":["${dataset.type.1}","gainexact","ordinarywould","atemon","readycent","expressionwish"],"jobOptions":[{"name":"Option 1","type":"string","programParameter":"--option-one","values":[]},{"name":"Option 2","type":"string","programParameter":"--option-two","values":[],"defaultValue":"Default for option 2","tip":"Option 2 should have an initial default value"},{"name":"plain","groupName":"Mode","type":"boolean","programParameter":"","values":[]},{"name":"verbose","groupName":"Mode","type":"boolean","programParameter":"--mode=verbose","values":[]},{"name":"effusive","groupName":"Mode","type":"boolean","programParameter":"--mode=effusive","values":[]},{"name":"silent","type":"boolean","programParameter":"--silent=true","values":[],"tip":"If set, shuts up regardless of Mode"},{"name":"View Type","type":"enumeration","programParameter":"--viewtype","values":["","fullframe","fullframe-overlay","beads beads-fullframe","beads-fullframe-overlay","flats","flats-fullframe","flats-fullframe-overlay","whitelights","whitelights-fullframe","whitelights-fullframe-overlay","darks darks-fullframe","biases","biases-fullframe"],"tip":"View Type: enumeration with many options, including blank"},{"name":"index","type":"integer","programParameter":"--index","values":[],"defaultValue":"1","minValue":"0","maxValue":"10","tip":"Initial index"},{"name":"origin","type":"float","programParameter":"--origin","values":[],"defaultValue":"0.0","minValue":"-2.0","maxValue":"2.0","tip":"Origin in range [-2.0,2.0]"}]});
            ijpService.getJobType('Test Options');
            ijpServer.flush();
        });
    });

    describe('getJob()', function () {
        it('should fetch a list of all jobs', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/status?sessionId=undefined').respond([{"jobId":1234,"name":"Test Options","date":"2016-07-12 08:51:20","status":"Completed"},{"jobId":1235,"name":"Date","date":"2016-07-12 09:35:15","status":"Queued"}]);
            ijpService.getJob();
            ijpServer.flush();
        });
        it('should fetch a specific job', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/status/1234?sessionId=undefined').respond([{"jobId":1234,"name":"Test Options","date":"2016-07-12 08:51:20","status":"Completed"}]);
            ijpService.getJob('1234');
            ijpServer.flush();
        });
    });

    describe('getJobOutput(jobId)', function(){
        it('should fetch the standard output for a specific job', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/output/1234?sessionId=undefined').respond({"output":"Fri Jul 8 12:04:02 BST 2016 - test_args.py starting\ntest_args.py starting...\nICAT sessionId provided\nICAT url = https://localhost:8181\nIDS url = https://localhost:8181\ndatasetIds =  416\ndatafileIds not supplied\nOption 1 =  ? \" ' / \\ . *\nOption 2 =  Default for option 2\nMode =  verbose\nSilent =  true\nView type =  darks darks-fullframe\nIndex =  4\nOrigin =  -1.4333333333333\nOther command-line arguments (if any):  []\ntest_args.py completed.\nFri Jul 8 12:04:02 BST 2016 - test_args.py ending with code 0\n"});
            ijpService.getJobOutput('1234');
            ijpServer.flush();
        })
    });

    describe('getErrorOutput(jobId)', function(){
        it('should fetch the error output for a specific job', function(){
            ijpServer.expectGET('https://localhost:8181/ijp/rest/jm/error/1234?sessionId=undefined').respond({"output":""});
            ijpService.getErrorOutput('1234');
            ijpServer.flush();
        })
    });

    describe('deleteJob(jobId)', function(){
        it('should delete a specific job', function(){
            ijpServer.expectDELETE('https://localhost:8181/ijp/rest/jm/delete/1234?sessionId=undefined').respond("");
            ijpService.deleteJob('1234');
            ijpServer.flush();
        })
    });

    describe('cancelJob(jobId)', function(){
        it('should cancel a specific job', function(){
            ijpServer.expectPOST('https://localhost:8181/ijp/rest/jm/cancel/1234').respond("");
            ijpService.cancelJob('1234');
            ijpServer.flush();
        })
    });

    describe('submitJob(jobTypeName, jobParameters[])', function(){
        it('submit a job with parameters', function(){
            ijpServer.expectPOST('https://localhost:8181/ijp/rest/jm/submit','jobName=Test+Options&parameter=--datasetIds%3D100,101&parameter=datafileIds%3D200&parameter=--option-one&parameter=Option+1+string&parameter=--option-two&parameter=Default+for+option+2&parameter=--mode%3Dverbose&parameter=--silent%3Dtrue&parameter=--viewtype&parameter=flata-fullframe&parameter=--index&parameter=1&parameter=--origin&parameter=0&sessionId=').respond({"jobId":1234});
            var jobParameters = ['--datasetIds=100,101','datafileIds=200','--option-one','Option 1 string','--option-two','Default for option 2','--mode=verbose','--silent=true','--viewtype','flata-fullframe','--index',1,'--origin',0];
            ijpService.submitJob('Test Options', jobParameters);
            ijpServer.flush();
        })
    });


});