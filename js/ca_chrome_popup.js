var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-33859566-3']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  // ga.src = 'https://ssl.google-analytics.com/ga.js';
  ga.src = 'https://stats.g.doubleclick.net/dc.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

var LEARNING_LEVEL = 1, FROM_LANGUAGE = 'English', TO_LANGUAGE = 'Spanish', isTranslationOn = true;
var temporaryJellies = 0, temporaryWords = undefined;

var cultureAlleyUserData = undefined;
//var siteUrl = 'http://ca-intap-testing-env.elasticbeanstalk.com';
var siteUrl = 'https://new.culturealley.com';
//var siteUrl = 'http://local.new.culturealley.com:8080/testing.new.culturealley.com';

var isReverseTranslation = document.getElementById("reverseTranslationId").checked;
if(isReverseTranslation) {
	isReverseTranslation=1;
} else {
	isReverseTranslation=0;
}

chrome.storage.sync.set({'reverseTranslationFlag': isReverseTranslation}, function() {});

var loadUserPreferences = function() {
	console.log('Loading user preferences ...');
	
	chrome.storage.sync.get(['from_language',
	                         'to_language',
	                         'learning_level',
	                         'to_language_translate_to',
	                         'reverseTranslationFlag',
	                         'cultureAlleyUserData',
	                         'temporaryJellies',
	                         'temporaryWords'], function(items) {
		var reverTranslator = items.reverseTranslationFlag;
		if(reverTranslator == 1) {
			$('#reverseTranslationId').prop('checked', true);
		} else {
			$('#reverseTranslationId').prop('checked', false);
		}
		
		$('#ca_from_language')[0].value = FROM_LANGUAGE = items.from_language || 'English';

		$('#ca_to_language')[0].value = TO_LANGUAGE = items.to_language || 'Spanish';
		
		if(TO_LANGUAGE == 'Mandarin') {
	    	$('#ca_script_selection_div').css('display', 'block');
	    	$('#ca_script_selection')[0].value = SCRIPTING = items.to_language_translate_to || 'Simplified';;
		} else {
	    	$('#ca_script_selection_div').css('display', 'none');
		}
		
		var level = items.learning_level;
		level = (level != undefined && level > 0 && level <= 5)? level: 1;
		LEARNING_LEVEL = level || 1;
		attachSlider();

		cultureAlleyUserData = items.cultureAlleyUserData;
		if(cultureAlleyUserData != undefined && cultureAlleyUserData.charAt(0) == '{') {
			cultureAlleyUserData = $.parseJSON(cultureAlleyUserData);
			if(cultureAlleyUserData.streaks != undefined) {
				$('.streakScore').text(cultureAlleyUserData.streaks.count);
			}
		}
		
		temporaryJellies = items.temporaryJellies || '0';
		temporaryJellies = parseInt(temporaryJellies);
		
		temporaryWords = items.temporaryWords || '[]';
		temporaryWords = (temporaryWords.charAt(0) == '[')? $.parseJSON(temporaryWords): [];
		
		updateJelliesInUI();
		updateUserWordsInUI();
		// retrieveStreaks();

		loadDatabase();
	});
};

var attachSlider = 	function() {
	var slider = $('#ca_level_slider').slider({
		min: 1,
		max: 5,
		range: "min",
		value: LEARNING_LEVEL,
		animate: true,
		create: function(event, ui) {
			if(LEARNING_LEVEL == 5) {
				$('#ca_level_slider .ui-slider-handle').css('margin-left', '-0.6em');
			} else {
				$('#ca_level_slider .ui-slider-handle').css('margin-left', '-0.1em');
			}
		},
		slide: function(event, ui) {
			if(ui.value == 5) {
				$('#ca_level_slider .ui-slider-handle').css('margin-left', '-0.6em');
			} else {
				$('#ca_level_slider .ui-slider-handle').css('margin-left', '-0.1em');
			}
			var value = ui.value;
			var property_hash ={};
			property_hash['newLevel']=value;
			chrome.storage.sync.set({"learning_level": value}, function() {
			    LEARNING_LEVEL = value;
			    addEventForAnalytics("Preference Changes", "Slide", "Learning Level: " + value, 1);
			    addDataForMixpanel("track","CElevelChanged",property_hash, 1);
			    reloadTab();
			});
		}
	});
};

var loadDatabase = function() {
	if(FROM_LANGUAGE == null || TO_LANGUAGE == null)
		return;
	var from = FROM_LANGUAGE.toLowerCase();
	var to = TO_LANGUAGE.toLowerCase();
	var xhr = new XMLHttpRequest();
	xhr.open("GET", "https://mail.culturealley.com/CATwitterApp.php?function=getSpecificDictionary&from=" + from + "&to=" + to, true);
	xhr.onreadystatechange = function() {
		if (xhr.readyState == 4) {
			var result = decodeURIComponent(xhr.responseText);
			var dictionaries = $.parseJSON(result);
			$.each(dictionaries, function(key, value) {
				if(key == from + '_to_' + to) {
					chrome.storage.local.get('dictionary', function(items) {
						var temp_items = items.dictionary;
						if(temp_items == undefined || temp_items == null)
							temp_items = {};
						else
							temp_items = $.parseJSON(temp_items);
						temp_items[key] = value;
						chrome.storage.local.set({'dictionary': JSON.stringify(temp_items)}, function() {});
					});
				}
			});
		}
	};
	xhr.send();
};

var isBlockedSite = function() {
	var blockedSites = ['culturealley.com', 'new.culturealley.com', 'google.co', 'console.aws.amazon.com', 'stackoverflow.co'];
	for(var i=0; i<blockedSites.length; i++) {
		if(window.location.href.toLowerCase().indexOf(blockedSites[i]) > 0)
			return true;
	}
	return false;
};

var reloadTab = function() {
	if(isTranslationOn && !isBlockedSite()) {
		if($('#ca_from_language').val() == '--select--')
			console.log('Choose \'from\' language ...');
		else if($('#ca_to_language').val() == '--select--')
			console.log('Choose \'to\' language ...');
		else if($('#ca_from_language').val() == $('#ca_to_language').val() && $('#ca_to_language').val() != 'English')
			console.log('Please choose a different \'to\' language ...');
		else
			chrome.tabs.reload();
	}
};

document.addEventListener('DOMContentLoaded', function () {
	loadUserPreferences();
	
	$('#ca_from_language').change(function() {
		var value = this.value;
		if(value == '--select--')
			return;
		chrome.storage.sync.set({'from_language': value}, function() {
		    FROM_LANGUAGE = value;
		    addEventForAnalytics("Preference Changes", "Change", "Native Language: " + value, 1);
		    reloadTab();
		});
	});
	$('#ca_to_language').change(function() {
		var value = this.value;
		if(value == '--select--')
			return;
		chrome.storage.sync.set({'to_language': value}, function() {
			TO_LANGUAGE = value;
		    
			addEventForAnalytics("Preference Changes", "Change", "Learning Language: " + value, 1);
		    if(value == 'Mandarin') {
		    	$('#ca_script_selection_div').css('display', 'block');
		    } else {
		    	$('#ca_script_selection_div').css('display', 'none');
		    	reloadTab();
		    }
		});
	});
	
	$('#reverseTranslationId').change(function() {
		var value = document.getElementById("reverseTranslationId").checked;
		if(value) {
			value = 1;
		} else {
			value = 0;
		}	
		chrome.storage.sync.set({'reverseTranslationFlag': value}, function() {
			isReverseTranslation = value;
			reloadTab();
		});
	});
	
	$('#ca_script_selection').change(function() {
		var value = this.value;
		chrome.storage.sync.set({'to_language_translate_to': value}, function() {
			TO_LANGUAGE = value;
			addEventForAnalytics("Preference Changes", "Change", "Learning Language Script: " + value, 1);
		    reloadTab();
		});
	});
	
	$("#onOffToggleBlock").click(function(evt) {
		if(isTranslationOn == false) {
			$(this).animate({left:'50px'});
			$(this).text("");
			setTimeout(function(){
				$("#onOffToggleBlock").text("OFF");
			}, 500);
			chrome.storage.sync.set({'isTranslationOn': true}, function() {
				addEventForAnalytics("Preference Changes", "Click", "Translator: On", 1);
				addDataForMixpanel("track","CEtransON","{}", 1);
				//on off people property
				//addDataForMixpanel("register","name","{'On_Off':'On'}");
			});
			isTranslationOn = true;
			reloadTab();
		} else {
			$(this).text("");
			$(this).animate({left:'0px'});
			setTimeout(function(){
				$("#onOffToggleBlock").text("ON");
			}, 500);
			chrome.storage.sync.set({'isTranslationOn': false}, function() {
				isTranslationOn = false;
				addEventForAnalytics("Preference Changes", "Click", "Translator: Off", 1);
				addDataForMixpanel("track","CEtransOFF","{}", 1);
			});
			reloadTab();
		}
		evt.stopPropagation();	
	});
	
	chrome.storage.sync.get('isTranslationOn', function(items) {
		isTranslationOn = (items.isTranslationOn == undefined)? true: items.isTranslationOn;
		if(isTranslationOn) {
			$("#onOffToggleBlock").text("OFF");
			$("#onOffToggleBlock").css("left","50px");
		} else {
			$("#onOffToggleBlock").text("ON");	
			$("#onOffToggleBlock").css("left","0px");
		}
	});
	
	$(".settingIcon").click(function(evt){
		$("#ca_language").toggle();
		evt.stopPropagation();
		addDataForMixpanel("track","CEftrSettings","{}", 1);
	});
	
	$("#ca_popup_body ,#ca_container").click(function(evt){
		$("#ca_language").css("display","none");
		evt.stopPropagation();
	});
	$("#ca_language").click(function(evt){
		evt.stopPropagation();
	});
	
});

function updateJelliesInUI() {
	var totalJellies = 0;
	if(!(cultureAlleyUserData != undefined && cultureAlleyUserData.jellies != undefined)) {
		totalJellies = temporaryJellies;
	} else {
		$.each(cultureAlleyUserData.jellies, function(i, v) {
			if(TO_LANGUAGE.toLocaleLowerCase() == v.learningLanguage.toLowerCase() &&
					FROM_LANGUAGE.toLocaleLowerCase() == v.nativeLanguage.toLowerCase()) {
				totalJellies = parseInt(v.redCandies) +
							   parseInt(v.greenCandies) + 
							   parseInt(v.yellowCandies) + 
							   parseInt(v.specialCandies);
			}
		});
	}

	$('.jellyScore').text(totalJellies);
	setBadge(totalJellies);
}

function updateUserWordsInUI() {
	var totalWords = 0;
	if(!(cultureAlleyUserData != undefined &&
			cultureAlleyUserData.userWords != undefined)) {
		totalWords = temporaryWords.length;
	} else {
		totalWords = cultureAlleyUserData.userWords.length;
	}

	$('.wordScore').text(totalWords);
}

function capitalizeFirstLetter(str) {
	if(typeof str !== 'string') return;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cultureAlleyLanguageId(lang) {
	if(typeof lang !== 'string') return -1;
	if(lang.toLowerCase() == 'mandarin' || lang.toLowerCase() == 'chinese')
		return 4;
	else if(lang.toLowerCase() == 'spanish')
		return 3;
	else if(lang.toLowerCase() == 'english')
		return 5;
	else
		return -1;
}

function addEventForAnalytics(category, action, opt_label, opt_value) {
	var request = {
			method: 'addEventForAnalytics',
			category: category,
			action: action,
			opt_label: opt_label,
			opt_value: opt_value
	};
	chrome.runtime.sendMessage(request, function(r) {});
}

function addDataForMixpanel(action, name, properties, opt_value) {
	var request = {
			method: 'addDataForMixpanel',
			action: action,
			name: name,
			properties: properties,
			opt_value: opt_value
	};
	chrome.runtime.sendMessage(request, function(r) {});	
}

function setBadge(badgeText) {
	chrome.runtime.sendMessage({method: 'setBadge', text: badgeText.toString()}, function(r) {});
}

$(function(){
	$("#playGame,#ca_footer").click(function(){
	chrome.runtime.sendMessage({
				method: 'openTabWithUrl',
				url: siteUrl + '/myWordList.jsp'
			}, function(r) {
			//	$('#ca_signup_popover').css('display', 'none');
			});
	});
	addDataForMixpanel("track","CEplayGames","{}", 1);
});