
(function() {
    'use strict';

    var app = angular.module('angularApp');

    app.controller('SearchParameterController', function($uibModalInstance, $filter){

        this.name = "";
        this.valueType = "";
        this.textValue = "";
        this.numberValue = 0;
        this.dateValue = new Date();
        this.isDateValueOpen = false;
        this.dateFormat = 'yyyy-MM-dd';

        this.parameterTypes = [
             {'name' : 'Text', 'id' : 'text'},
             {'name' : 'Number', 'id' : 'number'},
             {'name' : 'Date', 'id' : 'date'},
        ];

        this.openDateValue = function(){
            this.isDateValueOpen = true;
        };

        this.submit = function(){
            var value;
            if(this.valueType == 'text'){
                value = this.textValue;
            } else if(this.valueType == 'number'){
                value = this.numberValue;
            } else if(this.valueType == 'date'){
                value = $filter('date')(this.dateValue, this.dateFormat);
            }

            if(_.isUndefined(this.name) || _.isUndefined(this.valueType) ||  _.isUndefined(value)) return;

            $uibModalInstance.close({
                name: this.name,
                valueType: this.valueType,
                value: value
            });
        };

        this.cancel = function(){
            $uibModalInstance.dismiss('cancel');
        };
    });


})();
