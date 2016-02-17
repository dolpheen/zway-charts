
//var razberryURL = 'http://192.168.10.9:8083';
var razberryURL = '';
var razCharts = [];
var chartColors = ['#ff0066', '#2a8fbd', '#7fac1b', '#F44D27', '#44aa55', '#fbb829'];
var chartDivs = 15;
var chartCount = 0;
var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

$(document).ready( function() {
	var logs = [];
	
	$('#log-file-input').on('change', loadLocalFile);
	// Get Razberry revision
	$.getJSON(razberryURL + '/JS/Run/zway.controller.data.softwareRevisionVersion.value', function (data) {
		if( data )	{
			$('#notification #notification-raz-software').html('Razberry version: <b>' + data + '</b>');
		}
	}).error( function ( e ) {
		$('#notification #notification-message').html(' Error while connecting to RaZberry!');
	});

	// Get a list of currently running modules 
	$.getJSON(razberryURL + '/JS/Run/controller.registerInstances', function (data) {

		// Look for only for SensorValueLogging module instances
		logs = JSON.search(data, '//*[module="SensorValueLogging"]');
		if(logs.length > 0){
			$('#notification #notification-message').html('<b>' + logs.length + '</b>  active log(s) found');
			parseLogModuleFileNames( logs );	// Construct fileNames on Rzberry storage
			loadLogModuleData( logs );	// Get Log data from files
			
		}
	});
	
	

});

function parseLogModuleFileNames( vMods ) {
	vMods.forEach(function (vMod) {
		vMod.fileName = vMod.config.device + '_' + vMod.id;		
	});
};

function loadLogModuleData( vLogs ) {
	vLogs.forEach( function ( vLog ) {
		var fuck = razberryURL + '/JS/Run/loadObject("SensorValueLogging_' + vLog.fileName + '")';
		$.getJSON(razberryURL + '/JS/Run/loadObject("SensorValueLogging_' + vLog.fileName + '")', function (data) {
			vLog.logData = data;
			drawLogsChart(vLog);
		});
	});
}

function drawLogsChart( vLog ){
	//google.setOnLoadCallback(drawChart);
	var logArray = [];
	var isBinary = false;
	var lengthSensorData = vLog.logData.sensorData.length;
	
	vLog.isBinary = false;
	/*vLog.startIndex = 0;
	vLog.stopIndex = lengthSensorData;*/
	
	vLog.dataLength =  vLog.logData.sensorData.length;
	vLog.startTime = vLog.logData.sensorData[0].time;
	vLog.stopTime = vLog.logData.sensorData[lengthSensorData - 1].time;
	vLog.origStartTime = vLog.startTime;
	vLog.origStopTime = vLog.stopTime;
	vLog.timePeriod = vLog.stopTime - vLog.startTime;

	// Make an Array with Log data ready for chart
	logArray = prepareDataArray(vLog);

	chartCount++;

	var data = google.visualization.arrayToDataTable(logArray);
	var options = {
		title: vLog.logData.deviceId,
		curveType: 'function',
		legend: { position: 'bottom' },
		colors: [ chartColors[chartCount % 6] ],
		hAxis: { format:'d MMM HH:mm'}
	};

	var startTime = formatDateTime ( new Date(vLog.logData.sensorData[0].time), 1 );
	var stopTime = formatDateTime ( new Date(vLog.logData.sensorData[lengthSensorData - 1].time), 1 );
	
	calculateStatistic( vLog );

	$('#charts').append('<div class="chart-title-text"><h4>' + vLog.logData.deviceName +'</h4>');
	$('#charts').append('<div class="info-text">Totally <b>' + vLog.logData.sensorData.length +'</b> records from  <b>' + startTime + ' - ' + stopTime + '</b> </div><br/>');
	$('#charts').append('<div id="datePicker_' + vLog.fileName + '">	\
		<div class="input-daterange input-group" id="datepicker_' + vLog.fileName + '">	\
			<span class="input-group-addon"><span class="glyphicon glyphicon-calendar" aria-hidden="true"></span></span> \
    		<input type="text" class="input-sm form-control" name="start" value = "' + formatDateTime( new Date( vLog.startTime ), 2) + '"/>	\
		    <span class="input-group-addon"> - </span>	\
		    <input type="text" class="input-sm form-control" name="end" value = "' + formatDateTime( new Date( vLog.stopTime ), 2) + '" />	\
		</div>	\
		</div><br/>');
	$('#datePicker_' + vLog.fileName + ' .input-daterange').datepicker({ 
		startDate: new Date(vLog.startTime),
		endDate: new Date(vLog.stopTime),
		format: 'dd/mm/yyyy',
		todayHighlight: true,
		autoclose: true
	}).on( 'changeDate' , onChangeDate);
	$('#charts').append('<div id="staticText_' + vLog.fileName + '"" class="statistic-text">' + 'Records: <b>' + vLog.records +'</b>, Statistics - Min.: <b>' 
		 + vLog.minValue.toFixed(1) +'</b>, Max.: <b>' + vLog.maxValue.toFixed(1) + '</b>,  Avg.: <b>' + vLog.avgValue.toFixed(1) +'</b>,  Last: <b>' + vLog.lastValue.toFixed(1) +'</b></div><br/>');

	// Slider for scale 
	$('#charts').append('<div class="first chart-slider"><div class="first interval-text">Scale, %</div><input style="widht:200px;" id="sliderScale_' + vLog.fileName +'" data-slider-id="ex1Slider" type="text" data-slider-min="0" data-slider-max="100" data-slider-step="1" data-slider-value="0"/></div>');
	vLog.sliderScale = $('#sliderScale_' + vLog.fileName).slider({
		formatter: function(value) {
			return 'Current value: ' + value;
		}
	}).on('slide', logScaleChanged).data('slider');

	// Slider for Offset
	$('#charts').append('<div class="chart-slider"><div class="interval-text">Offset, %</div><input id="sliderOffset_' + vLog.fileName +'" data-slider-id="ex1Slider" type="text" data-slider-min="0" data-slider-max="100" data-slider-step="1" data-slider-value="0"/></div>');
	vLog.sliderOffset = $('#sliderOffset_' + vLog.fileName).slider({
		formatter: function(value) {
			return 'Current value: ' + value;
		}
	}).on('slide', logOffsetChanged).data('slider');

	$('#charts').append('<div id="curve_chart' + '_' + vLog.fileName + '" style="width: 1000px; height: 220px"></div>');
	$('#charts').append('<button type="button" class="btn btn-default btn-sm btn-success" id="buttonSave' + '_' + vLog.fileName + '">Save Log</button> ');
	$('#charts').append('<button type="button" class="btn btn-default btn-sm btn-primary" id="buttonRaw' + '_' + vLog.fileName + '">Raw Data</button> ');
	$('#charts').append('<button type="button" class="btn btn-default btn-sm btn-danger" id="button' + '_' + vLog.fileName + '">Reset Log!</button> ');
	
	
	$('#button' + '_' + vLog.fileName).click( { param1: vLog.fileName, param2: vLog.config.device, param3: vLog.logData.deviceName }, onLogReset );
	$('#buttonRaw' + '_' + vLog.fileName).click( { param1: vLog.fileName, param2: vLog.config.device, param3: vLog.logData.deviceName }, onShowRaw );
	$('#buttonSave' + '_' + vLog.fileName).click( { param1: vLog.fileName, param2: vLog.config.device, param3: vLog.logData.deviceName }, onLogSave );
	
	if( vLog.isBinary ) {
		var chart = new google.visualization.ColumnChart(document.getElementById('curve_chart' + '_' + vLog.fileName));
	} else {
		var chart = new google.visualization.AreaChart(document.getElementById('curve_chart' + '_' + vLog.fileName));
	}

	$('#charts').append('<div class="chartsSeparator"></div>');

	razCharts.push({Name: vLog.fileName, Chart: chart, Log:vLog, Options:options});
	chart.draw(data, options);
}

function prepareDataArray (vLog) {
	var logArray = [];
	
	logArray.push(['Time', 'Value']);

	if( vLog.startTime < vLog.logData.sensorData[0].time) vLog.startTime = vLog.logData.sensorData[0].time;
	if( vLog.stopTime > vLog.logData.sensorData[vLog.dataLength - 1].time) vLog.stopTime = vLog.logData.sensorData[vLog.dataLength - 1].time
	//if( vLog.stopTime - vLog.startTime < vLog.timePeriod /2 ) vLog.startTime = vLog.stopTime - vLog.timePeriod /2;

	for(var i = 0; i < vLog.dataLength; i++) {
		
		var val = 0;
		var data = vLog.logData.sensorData[i];
		
		if( !isNaN( parseFloat(data.value)) ) {
					val = data.value;
				} else {
					vLog.isBinary = true;
					if( data.value.toLowerCase() == 'on'){
						val = 1;
					}else{
						val = 0;
					}
				}

		if(data.time >= vLog.startTime && data.time <= vLog.stopTime) logArray.push([ new Date(data.time), val ]);
	}

	return logArray;
}


function onLogReset(event)	{

	if ( confirm('Delete Log Data for ' + event.data.param3 +' ?') ) {
	$.getJSON(razberryURL + '/JS/Run/saveObject("SensorValueLogging_' + event.data.param1 + '", { deviceId: "' + event.data.param2 + '", deviceName: "'+ event.data.param3 + '", sensorData: [] })',
		function (data) {
			location.reload();
		});
	}
}

function onShowRaw(event) {
	window.open(razberryURL + '/JS/Run/loadObject("SensorValueLogging_' + event.data.param1 + '")');
}

function onLogSave(event) {
	var saveObj = {};
	var date = new Date();
	saveObj.config = razCharts[0].Log.config; 
	saveObj.id = razCharts[0].Log.id; 
	saveObj.logData = razCharts[0].Log.logData; 
	saveObj.fileName = razCharts[0].Log.fileName + '-loc-' + date.getTime(); 
	
	
	var strlog = JSON.stringify(saveObj);
	var blob = new Blob([strlog], {type: "text/plain;charset=utf-8"});
	saveAs(blob, 'log-' + saveObj.fileName + '.json');
}

function loadLocalFile (evt) {
	var file = evt.target.files[0]; 
	var reader = new FileReader();

	var fuck = file.name.substr(-4).toLowerCase();
	if( file.name.substr(-4).toLowerCase() != 'json' ){
		alert('Select file with JSON extension.')
		return;	
	} 

	reader.onload = ( function (theFile) {
		if( theFile.total === theFile.loaded ) {
			var obj = theFile.target.result;
			if( obj ){
				obj = 'localFileLog = ' + obj;
				var log = eval(obj);
				if( log ){
					drawLogsChart( log );
				}
			}
		}
		return function (e) {
			console.log(e);
		};
	});
	if( file )reader.readAsText(file);
}

function logScaleChanged( slideEvt ) {
	var chartId = slideEvt.currentTarget.id.substring(12);
	razCharts.forEach ( function(chart) {
		if(chart.Name == chartId){
			var _chart = chart.Chart;
			var log = chart.Log;
			
			var timeDif =parseInt( log.timePeriod / ( 1 + 1 * slideEvt.value / 100),  10 );
			//var timeDif =parseInt( log.stopTime - log.startTime,  10 );
			//var timeDif = log.stopTime - log.startTime;
			if( log.stopTime - timeDif < log.origStartTime){
				log.startTime = log.origStartTime;
				log.stopTime = log.startTime + timeDif;
			} else {
				log.startTime = log.stopTime - timeDif;
			}

			var data = google.visualization.arrayToDataTable( prepareDataArray(log) );
			_chart.draw(data, chart.Options);	

			var rel = (log.startTime - log.origStartTime) / log.timePeriod;
			var offset = parseInt(rel * 100, 10);
			log.sliderOffset.setValue(offset);
		}
	});
}


function logOffsetChanged( slideEvt ) {
	var chartId = slideEvt.currentTarget.id.substring(13);
	razCharts.forEach ( function(chart) {
		if(chart.Name == chartId){
			var _chart = chart.Chart;
			var log = chart.Log;
			var changePercentage = slideEvt.value / 100;
			
			var timeDif = log.stopTime - log.startTime;

			var startTime = parseInt( (slideEvt.value / 100) * log.timePeriod + log.origStartTime );
			if( startTime + timeDif <= log.origStopTime) {
				log.startTime = startTime;
				log.stopTime = log.startTime + timeDif;
			}else{
				var rel = (log.startTime - log.origStartTime) / log.timePeriod;
				var offset = parseInt(rel * 100, 10);
				log.sliderOffset.setValue(offset);		
			}
		
			var data = google.visualization.arrayToDataTable( prepareDataArray(log) );
			_chart.draw(data, chart.Options);
		}
	});
}

function onChangeDate( dateEvt) {
	var chartId = dateEvt.currentTarget.id.substring(11);
	razCharts.forEach ( function(chart) {
		if(chart.Name == chartId){
			var _chart = chart.Chart;
			var log = chart.Log;

			if( dateEvt.target.name == 'start') {
				log.startTime = dateEvt.date.getTime();
				log.origStartTime = log.startTime;
			}

			if( dateEvt.target.name == 'end') {
				log.stopTime = dateEvt.date.getTime() + 24 * 60 * 60 * 1000;
				log.origStopTime = log.stopTime;
			}

			log.timePeriod = log.stopTime - log.startTime;

			calculateStatistic( log );
			$('#staticText_' + log.fileName).html('<div id="staticText_' + log.fileName + '"" class="statistic-text">' + 'Records: <b>' + log.records +'</b>, Statistics - Min.: <b>' 
		 + log.minValue.toFixed(1) +'</b>, Max.: <b>' + log.maxValue.toFixed(1) + '</b>,  Avg.: <b>' + log.avgValue.toFixed(1) +'</b>,  Last: <b>' + log.lastValue.toFixed(1) +'</b></div><br/>');
			
			var data = google.visualization.arrayToDataTable( prepareDataArray(log) );
			_chart.draw(data, chart.Options);
		}
	});
}

function formatDateTime( date,  type ) {
	var minutes = date.getMinutes();
	minutes = (minutes < 10 ? '0'+minutes : minutes);
	var hours = date.getHours();
	hours = (hours < 10 ? '0'+hours : hours);
	var day = date.getDate();
	day = (day < 10 ? '0'+day : day);
	var month = date.getMonth() + 1;
	month = (month < 10 ? '0'+month : month);
	var year = date.getFullYear();

	var formattedDateTime = '';
	if( type == 1 ) {
		formattedDateTime = day + '.' + month + '.' + year + ' ' + hours + ':' + minutes ;
	}else if (type == 2) {
		formattedDateTime = day + '/' + month + '/' + year;
	}
		
	return formattedDateTime;

}

function calculateStatistic( vLog ) {
	var minValue = Number.NaN;
		maxValue = Number.NaN,
		avgValue = 0,
		records = 0,
		lastValue =0;
	

	vLog.logData.sensorData.forEach( function ( data ) {
		var val = 0;
		if( !isNaN( parseFloat(data.value)) ) {
					val = data.value;
				} else {
					vLog.isBinary = true;
					if( data.value.toLowerCase() == 'on'){
						val = 1;
					}else{
						val = 0;
					}
				}
		if(data.time >= vLog.startTime && data.time <= vLog.stopTime){
			if( isNaN(minValue) || minValue > val ) minValue = val;
			if( isNaN(maxValue) || maxValue < val ) maxValue = val;
			records++;
			avgValue += val;
			lastValue = val;
		}
	});	
	if( records ) avgValue = avgValue / records;

	if( !isNaN(minValue) ) vLog.minValue = minValue;
	if( !isNaN(maxValue) ) vLog.maxValue = maxValue;
	vLog.avgValue = avgValue;
	vLog.records = records;
	vLog.lastValue = lastValue;
}

