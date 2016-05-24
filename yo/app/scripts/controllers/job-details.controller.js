
(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.controller('JobDetailsController', function($uibModalInstance, jobId){

        this.jobId = jobId;

        this.close = function (){
            $uibModalInstance.close();
        }

    });


})();
