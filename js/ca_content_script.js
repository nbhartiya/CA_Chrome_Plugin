var images_path = chrome.extension.getURL('/images/');
var popover_displaying_element = null, popover_displaying_element_detail = {};
var scroll_position_before_popup = 0;

var hasContentBeenReplaced = false, actualContent = null;
var LEARNING_LEVEL = 1, FROM_LANGUAGE = 'English', TO_LANGUAGE = 'Spanish', SCRIPTING='';
var temporaryJellies = 0, temporaryWords = undefined;

var dict_key = '', isTranslationOn, dictionary = {}, replacementCounts = 0, randomReplacementsArray = [];

//var siteUrl = 'http://ca-intap-testing-env.elasticbeanstalk.com';
var siteUrl = 'https://new.culturealley.com';
//var siteUrl = 'http://local.new.culturealley.com:8080/testing.new.culturealley.com';

var head = document.getElementsByTagName("head")[0];
fn = "function checkSpeakWord(speakWord) {"+
		"var correctSound=[\"great job\",\"awesome\",\"great going\",\"super\",\"amazing\"]; var incorrectSound=\"try again\" ; var randomnumber = (Math.floor(Math.random() * (4 - 0 +  1 )) + 0);"+
		"var word=$(\"#ca_popover_text\").text().substring(($(\"#ca_popover_text\").text().indexOf(\" =\"))+2,$(\"#ca_popover_text\").text().length).toUpperCase().trim();"+
			"if(speakWord.toUpperCase().trim()===word){"+
				"var randomWord = correctSound[randomnumber];"+
				'$("<audio src=https://mail.culturealley.com/ttsCultureAlley.php?tl=en&q="+encodeURIComponent(randomWord)+" ></audio>")[0].play();'+
				"$('.skipSpeak').click();"+
			"}else{"+
				'$("<audio src=https://mail.culturealley.com/ttsCultureAlley.php?tl=en&q="+encodeURIComponent("try again")+" ></audio>")[0].play();'+
				'var originalWord = $(\"#ca_popover_text\").text();$(\"#ca_popover_text\").text(\"Try Again\") ;setTimeout(function(){$(\"#ca_popover_text\").text(originalWord);},2000);'+
			"}"+
		"}";

var script = document.createElement('script');
script.setAttribute("type", "application/javascript");
script.textContent = fn;
head.appendChild(script);

function addBeforeLoginDataToUserData() {
	if(temporaryJellies > 0 && cultureAlleyUserData != undefined) {
		$.getJSON(siteUrl + '/updatedJellies.action', {
			userId: cultureAlleyUserData.userId,
			type: 'red',
			count: temporaryJellies,
			nativeLang: capitalizeFirstLetter(FROM_LANGUAGE),
			learningLang: capitalizeFirstLetter(TO_LANGUAGE)
		})
		.done(function(r) {
			chrome.storage.sync.remove('temporaryJellies', function() {
				temporaryJellies = 0;
			});
		})
		.fail(function(a, b, c) {
			console.log("addBeforeLoginDataToUserData Jellies Error:", a, b, c);
		})
		.always(function(a, b) {
			getEarnedCandies(capitalizeFirstLetter(FROM_LANGUAGE), capitalizeFirstLetter(TO_LANGUAGE));
		});
	}
	
	if(cultureAlleyUserData != undefined && temporaryWords.length > 0) {
		$.each(temporaryWords, function(i, v) {
			setTimeout(function() {
				$.getJSON(siteUrl + '/updateUserWordsList.action', {
					userId: cultureAlleyUserData.userId,
					nativeLanguageId: cultureAlleyLanguageId(FROM_LANGUAGE),
					learningLanguageId: cultureAlleyLanguageId(TO_LANGUAGE),
					word: encodeURIComponent(v.word),
					meaning: encodeURIComponent(v.meaning)
				}).done(function(dataNew) {
					if(dataNew.error == undefined) {
						for(var i = 0; i < temporaryWords.length; i++) {
							var ith = temporaryWords[i];
							if(decodeURIComponent(ith.word).trim().toLowerCase() == v.word.trim().toLowerCase() &&
									decodeURIComponent(ith.meaning).trim().toLowerCase() == v.meaning.trim().toLowerCase()) {
								temporaryWords.splice(i, 1);

								chrome.storage.sync.set({temporaryWords: JSON.stringify(temporaryWords)});
								break;
							}
						}
					} else {
						console.log('error:', dataNew);
					}
				});
			}, 1000);
		});
	}
}

function updateCurrentUserData() {
	var data = $('#currentUserData');
	if($(data).attr('userid') != undefined && $(data).attr('email') != undefined) {
		cultureAlleyUserData = {
			userId: $(data).attr('userid'),
			email: $(data).attr('email'),
			userWords: temporaryWords,
			jellies: [{
				learningLanguage: FROM_LANGUAGE.toLowerCase(),
				leaningLanguageId: cultureAlleyLanguageId(FROM_LANGUAGE),
				nativeLanguageId: cultureAlleyLanguageId(TO_LANGUAGE),
				nativeLanguage: TO_LANGUAGE.toLowerCase(),
				redCandies: temporaryJellies,
				yellowCandies: 0,
				greenCandies: 0,
				specialCandies: 0
			}]
		};
	}
	if(typeof cultureAlleyUserData === 'object') {
		addBeforeLoginDataToUserData();
		
		chrome.storage.sync.set({cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)}, function() {
			chrome.storage.sync.remove('shouldLoginRequest', function() {});
			
			addEventForAnalytics("Login", "check", "Logged In", 1);
		});
	}
};

function initiateLoginIfRequested() {
	chrome.storage.sync.get('shouldLoginRequest', function(items) {
		var shouldLoginRequest = items.shouldLoginRequest;
		if(shouldLoginRequest != undefined && shouldLoginRequest.charAt(0) == '{') {
			shouldLoginRequest = $.parseJSON(shouldLoginRequest);
			if((new Date().getTime() - shouldLoginRequest.reqTime) <= 10*60*1000) {
				var script = document.createElement('script');
				script.setAttribute("type", "application/javascript");
				script.textContent = 'if(typeof currentUserData === "object") {' +
										'var c = document.createElement("currentUserData");' +
										'document.getElementsByTagName("body")[0].appendChild(c);' +
										'c.setAttribute("id", "currentUserData");' +
										'c.setAttribute("userid", currentUserData.userId);' +
										'c.setAttribute("email", currentUserData.email);' +
									  '}';
				document.getElementsByTagName("body")[0].appendChild(script);
				updateCurrentUserData();
			} else {
				chrome.storage.sync.remove('shouldLoginRequest', function() {
					console.log('shouldLoginRequest removed because of time-expiration.');
					
					addEventForAnalytics("Login", "check", "Login request-time expire", 1);
				});
			}
		} else {
			addBeforeLoginDataToUserData();
		}
	});
};

$(document).ready(function() {
	console.log('Current page has finished loading ...');
	chrome.storage.sync.get(['learning_level',
	                         'from_language',
	                         'to_language',
	                         'to_language_translate_to',
	                         'cultureAlleyUserData',
	                         'temporaryJellies',
	                         'temporaryWords'], function(items) {
		
		LEARNING_LEVEL = items.learning_level || 1;
		FROM_LANGUAGE = items.from_language || 'English';
		TO_LANGUAGE = items.to_language || 'Spanish';
		if(TO_LANGUAGE == 'Mandarin')
			SCRIPTING = items.to_language_translate_to || 'Simplified';
		
		cultureAlleyUserData = items.cultureAlleyUserData;
		if(cultureAlleyUserData != undefined && cultureAlleyUserData.charAt(0) == '{') {
			cultureAlleyUserData = $.parseJSON(cultureAlleyUserData);
		}
		
		temporaryJellies = items.temporaryJellies || '0';
		temporaryJellies = parseInt(temporaryJellies);
		
		temporaryWords = items.temporaryWords || '[]';
		temporaryWords = (temporaryWords.charAt(0) == '[')? $.parseJSON(temporaryWords): [];

		initiateLoginIfRequested();
		
		var from_language = FROM_LANGUAGE.toLowerCase();
		var to_language = TO_LANGUAGE.toLowerCase();
		dict_key = from_language + '_to_' + to_language;
		
		chrome.storage.local.get('dictionary', function(dict_items) {
			var temp_dict = dict_items.dictionary;
			if(temp_dict) {
				temp_dict = $.parseJSON(temp_dict);
				dictionary = temp_dict[dict_key];
				if(dictionary != undefined || dictionary != null) {
					refreshTabContent();
				} else {
					loadDatabase();
				}
			} else {
				loadDatabase();
			}
		});
	});
	scroll_position_before_popup = $(document).scrollTop();
});

var isBlockedSite = function() {
	var blockedSites = ['culturealley.com',
	                    'new.culturealley.com',
	                    'google.co',
	                    'console.aws.amazon.com',
	                    'stackoverflow.co'];
	for(var i=0; i<blockedSites.length; i++) {
		if(window.location.href.toLowerCase().indexOf(blockedSites[i]) > 0)
			return true;
	}
	return false;
};

function updateTranslationsToLearningLevel() {
	var percent = 5/100;
	switch(LEARNING_LEVEL) {
		case 2: { percent = 25/100; break; }
		case 3: { percent = 50/100; break; }
		case 4: { percent = 75/100; break; }
		case 5: { percent = 100/100; break; }
	}
	
	console.log($('.replaced_word_to_popup').length);
	replacementCounts = $('.replaced_word_to_popup').length;
	var actualReplacemets = parseInt(replacementCounts*percent);
	randomReplacementsArray = randomReplacementsArray.slice(0, replacementCounts);
	randomReplacementsArray = shuffleArray(randomReplacementsArray);
	randomReplacementsArray = randomReplacementsArray.slice(0, actualReplacemets);
	randomReplacementsArray.sort(function(a,b){if(a < b)return -1;if(a > b)return 1;return 0;});
	
	var j = 0;
	$('.replaced_word_to_popup').each(function(i, v) {
		if(i == randomReplacementsArray[j]) {
			j++;
		} else {
			$(this).before($(this).attr('word'));
			$(this).remove();
		}
	});
	console.log($('.replaced_word_to_popup').length);
}

function shuffleArray(array) {
	var tmp, curr, top = array.length;
	if(top) {
		while(--top) {
			curr = Math.floor(Math.random() * (top + 1));
			tmp = array[curr];
			array[curr] = array[top];
			array[top] = tmp;
		}
	}
	
	return array;
}

var refreshTabContent = function() {
	chrome.storage.sync.get(['isTranslationOn'], function(items) {
		isTranslationOn = (items.isTranslationOn == undefined)? true: items.isTranslationOn;
		
		if(isTranslationOn && !isBlockedSite()) {
			if(hasContentBeenReplaced == false) {
				hasContentBeenReplaced = true;
				var body = $('body')[0].outerHTML;
				var children = (new DOMParser()).parseFromString(body, 'text/html').firstChild.childNodes;
				actualContent = children[1];
				actualContent = getCustomizedElement(actualContent);
				$('body')[0].outerHTML = actualContent.outerHTML;
				updateTranslationsToLearningLevel();
				setPopoverFunctionalities();
			} else if(actualContent != null) {
				$('body')[0].outerHTML = actualContent;
				actualContent = null;
				hasContentBeenReplaced = false;
			}
			getEarnedCandies("English", "Spanish");
			getUserWords();
			retrieveStreaks();
		} else if(actualContent != null) {
			$('body')[0].outerHTML = actualContent;
			actualContent = null;
			hasContentBeenReplaced = false;
		} else {
			console.log('Translation is set off or no content ...');
		}
	});
};

var loadDatabase = function() {
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
						
						chrome.storage.local.set({'dictionary': JSON.stringify(temp_items)}, function() {
							dictionary = value;
							dict_key = key;
							refreshTabContent();
						});
					});
				}
			});
		}
	};
	xhr.send();
};

function shouldNotTranslateThisTag(element) {
	var tags = ['a', 'input', 'textarea', 'script', 'title', 'head', 'meta', 'link', 'form'];
	var flag = false;
	for(var i = 0; i < tags.length; i++) {
		if($(element).is(tags[i])) {
			flag = true;
			break;
		}
	}

	return flag;
}

var getCustomizedElement = function recurse(element) {
	if(shouldNotTranslateThisTag(element)) {
		return element;
	}

	if(element.childNodes.length > 0) {
		for(var i = 0; i < element.childNodes.length; i++) {
			if(element.childNodes[i].nodeType == Node.TEXT_NODE && /\S/.test(element.childNodes[i].nodeValue)) {
				var child = element.childNodes[i];
				var htmlNode = recurse(child);
				if($.type(htmlNode) != 'string') {
					htmlNode.insertBefore(child);
					child.remove();
				} else {
					element.childNodes[i] = recurse(element.childNodes[i]);
				}
			} else {
				element.childNodes[i] = recurse(element.childNodes[i]);
			}
		}
	}

	if(element.nodeType == Node.TEXT_NODE && /\S/.test(element.nodeValue)) { 
		var newInnerHTML = customizedText(element.nodeValue);
		return newInnerHTML;
	}

    return element;
};

var customizedText = function(text) {
	var allText = text, customizedAllText = '', replacements = new Array(0), replacement = '', position = 0;
	customizedAllText = '';
	
	var prev_char, next_char;
	$.each(dictionary, function(dataKey, dataValue) {
		if(dataKey == 'Dictionary') {
			var lowerCaseAllText = allText.toLowerCase();
			$.each(dataValue, function(tagName, tagDictionary) {
				$.each(tagDictionary, function(word, meaning) {
					position = lowerCaseAllText.indexOf(word.toLowerCase());
					while(position > -1 && $.trim(meaning) != '') {
						if(position != 0)
							prev_char = lowerCaseAllText.charAt(position-1);
						else
							prev_char = ' ';
						if(position + word.length < lowerCaseAllText.length)
							next_char = lowerCaseAllText.charAt(position + word.length);
						else
							next_char = ' ';
						if(isCharacterSpaceOrSpecialChracter(prev_char) && 
								isCharacterSpaceOrSpecialChracter(next_char)) {
							var isLearntWord = false;
							if(cultureAlleyUserData != undefined && cultureAlleyUserData.userWords != undefined) {
								for(var kl = 0; kl < cultureAlleyUserData.userWords.length; kl++) {
									var v = cultureAlleyUserData.userWords[kl];
									if(v.word.toLowerCase().trim() == word.toLowerCase().trim()) {
										if(TO_LANGUAGE == 'Mandarin') {
											if(SCRIPTING == 'Simplified') {
												
											} else {
												
											}
										} else {
											replacement = '<span class="completed-word" ' +
											   					 'style="border-bottom: 1px solid #49c9af;" ' +
											   					 'ln="' + TO_LANGUAGE.toLowerCase() + '" ' +
											   					 'word="' + allText.substring(position, position + word.length) + '" ' +
											   					 'meaning="' + synchronizeWords(meaning, allText.substring(position, position + word.length)) + '" ' +
											   					 'category="' + tagName + '">' +
											   					synchronizeWords(meaning, allText.substring(position, position + word.length)) +
											   			  '</span>';
											replacements.push({
												start: position, 
												end: position + word.length, 
												word: word, 
												replacement: replacement, 
												meaning: meaning,
												tag: tagName,
												completed: true
											});
										}
										isLearntWord = true;
										break;
									}
								}
							}
							
							if(!isLearntWord && TO_LANGUAGE == 'Mandarin') {
								if(SCRIPTING == 'Simplified') {
									replacement = '<span class="animated  rubberBandSmall redCandy replaced_word_to_popup" ' +
														 'ln="spanish" ' +
														 'meaning="' + synchronizeWords(meaning[0], allText.substring(position, position + word.length)) + '" ' +
														 'script-meaning="' + synchronizeWords(meaning[1], allText.substring(position, position + word.length)) + '" ' +
														 'word="' + allText.substring(position, position + word.length) + '" ' +
														 'ca_tag="' + tagName + '">' +
														 	'\u00a0' + synchronizeWords(meaning[0], allText.substring(position, position + word.length)) + '\u00a0' +
												  '</span>';
									replacements.push({
										start: position,
										end: position + word.length, 
										word: word, 
										replacement: replacement, 
										meaning: meaning[0], 
										tag: tagName,
										completed: false
									});
								} else {
									replacement = '<span class="animated  rubberBandSmall redCandy replaced_word_to_popup" ' +
														 'ln="spanish" ' +
														 'meaning="' + synchronizeWords(meaning[1], allText.substring(position, position + word.length)) + '" ' +
														 'word="' + allText.substring(position, position + word.length) + '" ' +
														 'ca_tag="' + tagName + '">' +
														 	'\u00a0' + synchronizeWords(meaning[1], allText.substring(position, position + word.length)) + '\u00a0' +
												  '</span>';
									replacements.push({
										start: position,
										end: position + word.length,
										word: word,
										replacement: replacement,
										meaning: meaning[1],
										tag: tagName,
										'script_meaning' : meaning[0],
										completed: false
									});
								}
							} else if(!isLearntWord) {
								replacement = '<span class="animated  rubberBandSmall redCandy replaced_word_to_popup" ' +
													 'ln="spanish" ' +
													 'meaning="' + synchronizeWords(meaning, allText.substring(position, position + word.length)) + '" ' +
													 'word="' + allText.substring(position, position + word.length) + '" ' +
													 'ca_tag="' + tagName + '">' +
													 	'\u00a0' + synchronizeWords(meaning, allText.substring(position, position + word.length)) + '\u00a0' +
											  '</span>';
								replacements.push({
									start: position, 
									end: position + word.length, 
									word: word, 
									replacement: replacement, 
									meaning: meaning,
									tag: tagName,
									completed: false
								});
							}
						}
						position = lowerCaseAllText.indexOf(word.toLowerCase(), position+1);
					}
					position = 0;
				});
			});
			
			var currentObject = '', jthObject = '', i = 0, j = 0, length = replacements.length, removed = 0;
			for(i = 0; i < (length - removed); i++) {
				currentObject = replacements[i];
				for(j = i+1; j < (length - removed); j++) {
					jthObject = replacements[j];
					if(jthObject.start <= currentObject.start && jthObject.end >= currentObject.start && jthObject.end < currentObject.end) {
						jthObject = replacements.splice(j, 1);
						j--;
						removed++;
					} else if(jthObject.start > currentObject.start && jthObject.start <= currentObject.end && jthObject.end >= currentObject.end) {
						jthObject = replacements.splice(j, 1);
						j--;
						removed++;
					} else if (jthObject.start > currentObject.start && jthObject.end < currentObject.end) {
						jthObject = replacements.splice(j, 1);
						j--;
						removed++;
					} else if(jthObject.start <= currentObject.start && jthObject.end >= currentObject.end) {
						replacements.splice(i, 1);
						i--;
						removed++;
						break;
					} else if(currentObject.start > jthObject.start) {
						replacements[i] = jthObject;
						replacements[j] = currentObject;
						
						currentObject = jthObject;
					}
				}
			}
			
			var begin = 0;
			for(var i=0; i < replacements.length; i++) {
				if(!replacements[i].completed)
					randomReplacementsArray.push(++replacementCounts);
				customizedAllText += allText.substring(begin, replacements[i].start) + replacements[i].replacement;
				begin = replacements[i].end;
			}
			
			customizedAllText += allText.substring(begin, allText.length);
		}
	});
	
	if(customizedAllText == '' || customizedAllText == allText)
		return text;
	else
		return $('<span>' + customizedAllText + '</span>');
};

function synchronizeWords(thisWord, toThatWord) {
	if(parseInt(toThatWord).toString() == toThatWord)
		return thisWord.toLowerCase();
	else if(toThatWord.toLowerCase == toThatWord)
		return thisWord.toLowerCase();
	else if(toThatWord.toUpperCase() == toThatWord)
		return thisWord.toUpperCase();
	else if(capitalizeFirstLetter(toThatWord) == toThatWord)
		return capitalizeFirstLetter(thisWord);
	else
		return thisWord.toLowerCase();
}

var isCharacterSpaceOrSpecialChracter = function(char) {
	var regex = new RegExp("[ !,.?]", 'gim');
	return regex.test(char);
};

var setPopoverHTML = function() {
	var signupHTML = $('<div id="ca_signup_popover_curtain" style="position: fixed;left: 0px;top: 0px;width: 0px;height: 0px;background-color: #000;opacity: 0.3;"></div>' +
					   '<div id="ca_signup_popover" style="border-radius: 30px;z-index: 2000;display: none;position: fixed;left: 0px;top: 0px;height: 240px;width: 290px;background-color: #2b3e50;padding: 40px 80px;box-shadow:5px 5px 10px rgba(0,0,0,.2);">' +
							'<div onclick="window.open(\'https:\\culturealley.com\',\'_blank\')" style="text-align:center;cursor:pointer;"><img src="' + images_path + '/yellow-jelly-300px.png" style="width:100px;" /></div>'+
							'<div style="color: white;font-size: 25px;text-align: center;margin-top: 20px;margin-bottom: 45px;font-family:OpenSans;">' +
								'<span style="font-weight:bold;">SAVE YOUR WORDLIST</span><br><span style="font-size:20px;">AND PRACTICE WITH GAMES!</span>' +
							'</div>' +
							'<a href="javascript:void(0)" id="ca_initiate_signup" class="ui-btn ui-corner-all ui-btn-c" style="border-color:#49C9AF!important;border-radius:100px;">Signup Now!</a>' +
							'<a href="javascript:void(0)" id="ca_stop_signup" class="ui-btn ui-corner-all ui-btn-c" style="border:none;text-decoration:underline!important;color:#aaa;border-radius:100px;background:none;font-size: 12px;">or SignUp later</a>' +
						'</div>');
	
	var popupHTML = $('<div id="ca_popover" class="translationPopupClass" style="border-radius:30px;z-index: 1000;display:none; position: absolute;left: 0px;top: 0px;height: 233px;width: 274px;">' +
						'<div class="listenTranslatedWordForFacebook listenImgForFacebook bigIconCircle" id="ca_listen_word"  style="background:#f8ce46; height: 50px;width: 50px; left:110px;top: 90px;-webkit-animation-iteration-count: infinite;animation-iteration-count: infinite;"> <div class="shadowDiv45" style=""></div> <img src="'+images_path+'/soundIconWhite_2.png" style="position:absolute; left:10px; top:12px;width:30px;">  </div>'+
						'<div class="showOnCrome bigIconCircle animated pulse" style="display:none;background:#FE5C57; height: 70px;width: 70px;left:100px;top: 90px;"> <div class="shadowDiv45" style=""></div> <img src="' + images_path + '/mic_White_2.png" style="position:absolute; left:26px; top:17.5px;">'+
							"<input id='mic'  lang='es-ES' onwebkitspeechchange='checkSpeakWord(this.value);"+
									"this.value =  &quot; &quot; ; \'x-webkit-speech style=\'height: 70px;font-size: 44px;width: 50px; padding-right:20px ;text-align: center;border: none; border-radius: 50%;  background: #fff;z-index: 200;position: absolute;top: 0px;left: 0px;color: #bd1550; opacity:0;cursor: pointer;'/>"+
						 '</div>'+
						 '<div class="skipSpeak bigIconCircle animated pulse" style="display:none;font-size: 13px;background: #49C9AF; height: 30px; width: 30px; left: 200px; top: 115px; text-align: center; line-height: 30px;">Skip</div>'+
						 '<div class="skipSpeak nextInlistenTranslatedWordForFacebook bigIconCircle yellow-arrow-horizontal " onclick="" style="box-shadow:none;background: url(https://s3.amazonaws.com/ca_web/Gamification/img/forward-button.png); left: 60px; top: 170px; text-align: center; line-height: 50px; border-radius: 10px; width: 150px; height: 50px; font-size: 17px;-webkit-animation-iteration-count: infinite;animation-iteration-count: infinite;position:absolute;">Win a jelly...</div>'+
						 '<table width="274px" style="height: 95px;position: absolute;top: 0px;left: 0px;text-align: center;color: #FFFFFF;" cellspacing="0px">'+
						 	'<tr>'+
						 		'<td style="vertical-align: middle; text-transform:uppercase ;text-align: center;font-size: 30px; "colspan="3">'+
						 			'<span id="ca_popover_text" style="color:white!important;line-height: normal!important;font-family:OpenSans;"> </span>'+
						 		'</td>'+
						 	'</tr>'+
						'</table>'+
						'<div class="showOnCrome" style="position: absolute;top: 145px;left: 110px; font-size:15px;">LISTEN</div>'+
						'<div class="ui-popup-arrow-container ui-popup-arrow-t" style="left: 127px;top:-8px!important;"><div class="ui-popup-arrow ui-body-a ui-overlay-shadow"></div></div>'+
					'</div>');
				
	var quizPopUpHTML = $('<div id="quizPopup" class="" style="border-radius:30px;z-index: 1000;display:none; position: absolute;left: 0px;top: 0px;height: 220px;width: 274px;">' +
							'<table width="274px" style="padding: 5px 10px; top: 0px;left: 0px;text-align: center;" cellspacing="0px">'+
								'<tr>'+
									'<td style="vertical-align: middle; text-transform:uppercase ;text-align: center;font-size: 20px; "colspan="3">'+
										'<span id="quiz_popover_text"> CHOOSE AN OPTION</span>'+
									'</td>'+
								'</tr>'+
							'</table>'+
							'<div style="position: absolute;z-index: 10;margin-top: 13px;right: 25px;">'+
								'<img class="quizpopUpTick1" src="' + images_path + 'green-tick-30.png" style="display: none;position:absolute;right: 0px;">'+
								'<img class="quizpopUpTick2" src="' + images_path + 'green-tick-30.png" style="display: none;position:absolute;top: 47px;right: 0px;">'+
								'<img class="quizpopUpTick3" class="" src="' + images_path + 'green-tick-30.png" style="display: none;position:absolute;top:94px;right: 0px;">'+
							'</div>'+
							'<a href="javascript:void(0)" class="quizWord1Text  ui-btn ui-corner-all ui-btn-c startNowbutton " style="border-color:#49C9AF!important;border-radius:100px;">temporal</a>'+
							'<a href="javascript:void(0)" class="quizWord2Text  ui-btn ui-corner-all ui-btn-c startNowbutton " style="border-color:#49C9AF!important;border-radius:100px;">templo</a>'+
							'<a href="javascript:void(0)" class="quizWord3Text  ui-btn ui-corner-all ui-btn-c startNowbutton " style="border-color:#49C9AF!important;border-radius:100px;">temperatura</a>'+
							'<div class="ui-popup-arrow-container ui-popup-arrow-t" style="left: 127px;top:-8px;"><div class="ui-popup-arrow ui-body-a ui-overlay-shadow"></div></div>	'+
			 			'</div>');
						
	var typingQuizPopUpHTML = $('<div id="typingQuizPopup" class="" style="border-radius:30px;z-index: 1000;display:none; position: absolute;left: 0px;top: 0px;height: 220px;width: 274px;">' +
									'<div id="typingQuizPopupHeader">Type the word</div>'+
									'<div id="typingQuizPopupTextBox">'+
										'<input id="typingQuizPopupTextBoxInput" type="text" style="width: 200px;height: 30px;">'+
									'</div>'+
									'<div id="tryAgainIntypingQuiz" style="text-align:center;display:none;color:red;font-size:20px;"><span>Try Again</span></div>'+
									'<a id="typingQuizPopupSubmit" align="center" style="width:100px;margin:auto;padding: 15px;margin-top: 25px;" class="ui-btn ui-corner-all ui-btn-b ">Win a Jelly!</a>'+
									'<div id="typingQuizPopupDetail" style="visibility: hidden;">'+
										'<span id="word"></span>'+
										'<span id="meaning"></span>'+
									'</div>'+
									'<div class="ui-popup-arrow-container ui-popup-arrow-t" style="left: 127px;top:-8px;"><div class="ui-popup-arrow ui-body-a ui-overlay-shadow"></div></div>'+
								'</div>');
								
	var underlinedReplacementPopup = $('<div id="underlinedReplacementPopup" data-arrow="t,b" data-theme="a" style="z-index:10;display:none;">'+
											'<div >'+
												'<div id="underlinedReplacementPopupDetail">'+
													'<span id="meaning"></span><span> = </span><span id="word"></span>'+
												'</div>' +
												'<span id="tl" style="visibility: hidden;"></span>'+
											'</div>'+
											'<div class="listenTranslatedCompletedWord bigIconCircle" id="ca_listen_word" style="background:#f8ce46; height: 70px;width: 70px; left:112px;top: 110px;"> <div class="shadowDiv45" style=""></div> <img src="'+images_path+'/soundIconWhite_2.png" style="position:absolute; left:19px; top:20.5px;"></div>'+
											'<div class="ui-popup-arrow-container ui-popup-arrow-t" style="left: 127px;top: -8px;"><div class="ui-popup-arrow ui-body-a ui-overlay-shadow"></div></div>'+
										'</div>');
										
	
	var jellyJar = $('<div onclick="openJellyCountPopup()" class="headerJellyJar iconSectionTop"  style="border-radius: 0px 0px 0px 20px;position: fixed; top: 0px; padding: 10px; text-align: center; background: #F8CE46; right: 0px; z-index: 20000; margin: 0px; ">'+
					'<img src="' + images_path + 'jar-small.png"  class="headerJellyJarImage animated"> <div style="color:#2B3E50;"> <span class="scorePoint">0</span> Jellies</div> </div>');
	
	var animatedJelly  = $('<div class="animatedJellyContainer" style="display:none;top:300px; left:250px;position:absolute;z-index:30000; -webkit-transition:  -webkit-transform 1000ms linear; transition:  transform 1000ms linear"> '+
							'<div class="animatedJelly collected-jelly collected-jelly-red" style="background-image:url('+images_path+'/red-jelly-60px.png);">'+
								'<div style="position: absolute;" class="jellyHaloGlow"> </div>'+
							'</div>'+
						'</div>');
	
	$(signupHTML).appendTo('body');
	$(popupHTML).appendTo('body');
	$(jellyJar).appendTo('body');
	$(quizPopUpHTML).appendTo('body');
	$(typingQuizPopUpHTML).appendTo('body');
	$(underlinedReplacementPopup).appendTo('body');
	$(animatedJelly).appendTo('body');
	$("#ca_popover").click(function(event){
		event.stopPropagation();
	});
	$("#quizPopup").click(function(event){
		event.stopPropagation();
	});
	$("#typingQuizPopup").click(function(event){
		event.stopPropagation();
	});

	$('#typingQuizPopupSubmit').click(function(e) {
		greenPopupSubmitted();
	});
	
	$('#typingQuizPopupTextBoxInput').keyup(function(e) {
		if(e.keyCode == 13) {
			greenPopupSubmitted();
		}
	});
	
	$(".listenTranslatedWordForFacebook ").click(function(){
		playAudio(popover_displaying_element_detail.meaning,TO_LANGUAGE);
		evt.stopPropagation();
	});
	$(".listenTranslatedCompletedWord ").click(function(evt){
		playAudio($('#underlinedReplacementPopupDetail > #meaning').text(),TO_LANGUAGE);
		evt.stopPropagation();
	});
	$("#ca_initiate_signup").click(function(event) {
		addEventForAnalytics("Login", "check", "Redirected to Login", 1);
		chrome.storage.sync.set({
			shouldLoginRequest: '{"shouldLogin": true, "reqTime": ' + new Date().getTime() + '}'
		}, function(items) {
			chrome.runtime.sendMessage({
				method: 'openTabWithUrl',
				url: siteUrl + '/chromePlugin.jsp'
			}, function(r) {
				$('#ca_signup_popover').css('display', 'none');
			});
		});
	});
	
	$('#ca_stop_signup').click(hideSignupPopup);
};

function languageCodes(lang) {
	if(lang.toLowerCase() == 'english')
		return 'en-US';
	else if(lang.toLowerCase() == 'spanish')
		return 'es';
	else if(lang.toLowerCase() == 'chinese' || lang.toLowerCase() == 'mandarin')
		return 'zh-CH';
	else if(lang.toLowerCase() == 'hindi')
		return 'hi-IN';
}

function playAudio(_meaning, TO_LANGUAGE){
	$('<audio id="ca_word_player" src="https://mail.culturealley.com/ttsCultureAlley.php?tl=' + languageCodes(TO_LANGUAGE) +'&q='+ encodeURIComponent(_meaning) + '"></audio>')[0].play();
}

function showUnderlinedReplacementPopup(element, evt) {
	$('#underlinedReplacementPopupDetail > #word').text($(element).attr('word'));
	$('#underlinedReplacementPopupDetail > #meaning').text($(element).attr('meaning'));
	
	var element_pos = $(element).offset();
	var width = $(element).width(), height = $(element).height();
	var center_x = element_pos.left + width/2;
	var popup_top = (element_pos.top + height + 5 + 10);
	var popup_left = 137;

	if(center_x > 137 && ($(window).width() - center_x) > 137)
		popup_left = (center_x - 137);
	else if(center_x < 137)
		popup_left = 0;
	else
		popup_left = ($(window).width() - 274);

	var arrow_left = center_x - popup_left - 7;
	$('.ui-popup-arrow-container').css('left', arrow_left);
	$('#underlinedReplacementPopup').css('left', popup_left).css('top', popup_top);

	scroll_position_before_popup = $(document).scrollTop();
	if((popup_top - $(document).scrollTop()) > ($(window).height() - $('#underlinedReplacementPopup').height() - 10)) {
		var scroll_to = (popup_top - ($(window).height() - $('#underlinedReplacementPopup').height() - 10));
		$('html, body').animate({scrollTop: scroll_to}, 400);
	}
	$("#underlinedReplacementPopup").css("display","block");
	evt.stopPropagation();
}

var setPopoverFunctionalities = function() {
	setPopoverHTML();
	
	$(".completed-word").click(function(evt){
		showUnderlinedReplacementPopup(this, evt);
		evt.stopPropagation();
	});
	
	$('.replaced_word_to_popup').click(function(event) {
		closepopUpHighlightDivForFacebook();
		
		var tapped_meaning_tag = $(this).attr('ca_tag');
		var tapped_meaning = $(this).attr('meaning');
		var tapped_word = $(this).attr('word');
		popover_displaying_element = this;
			
		var _meaning = tapped_meaning;
		if(TO_LANGUAGE == 'Mandarin' && SCRIPTING == 'Simplified')
			_meaning = $(this).attr('script-meaning');
		
		if(TO_LANGUAGE == 'Mandarin' && SCRIPTING == 'Simplified')
			popover_displaying_element_detail = {
				'tag': tapped_meaning_tag,
				'word': tapped_word,
				'meaning': tapped_meaning,
				'script_meaning': _meaning
			};
		else
			popover_displaying_element_detail = {
				'tag': tapped_meaning_tag,
				'word': tapped_word,
				'meaning': tapped_meaning
			};
		
		if($(this).hasClass("redCandy")) {
			addEventForAnalytics("Learn", "click", "Word: " + popover_displaying_element_detail.meaning, 1);
			$('#quizPopup').css('display', 'none');
			$('#typingQuizPopup').css('display', 'none');
			
			playAudio(_meaning, TO_LANGUAGE);
			// $('<audio id="ca_word_player" src="https://mail.culturealley.com/ttsCultureAlley.php?tl=' + languageCodes(TO_LANGUAGE) +'&q='+ encodeURIComponent(_meaning) + '"></audio>')[0].play();
				
			var element_pos = $(popover_displaying_element).offset();
			var width = $(popover_displaying_element).width(), height = $(popover_displaying_element).height();
			var center_x = element_pos.left + width/2;
			var popup_top = (element_pos.top + height + 5 + 10);
			var popup_left = 137;
	   			
			if(center_x > 137 && ($(window).width() - center_x) > 137)
				popup_left = (center_x - 137);
			else if(center_x < 137)
				popup_left = 0;
			else
				popup_left = ($(window).width() - 274);
				
			var arrow_left = center_x - popup_left - 7;
			$('.ui-popup-arrow-container').css('left', arrow_left);
			$('#ca_popover').css('left', popup_left).css('top', popup_top);
	   		$('#ca_popover_text').text(tapped_word + " = " + tapped_meaning);
				if($('#ca_popover_text').text().length > 20){
					$('#ca_popover_text').css("font-size","20px");
				}else{
					$('#ca_popover_text').css("font-size","30px");
				}
	   		$('#ca_popover').css('display', 'block');
	
	   		scroll_position_before_popup = $(document).scrollTop();
	   		if((popup_top - $(document).scrollTop()) > ($(window).height() - $('#ca_popover').height() - 10)) {
				var scroll_to = (popup_top - ($(window).height() - $('#ca_popover').height() - 10));
				$('html, body').animate({scrollTop: scroll_to}, 400);
			}
		} else if($(this).hasClass("yellowCandy")) {
			$('.skipSpeak').click();
		} else if($(this).hasClass("greenCandy")) {
			var element_pos = $(popover_displaying_element).offset();
			var width = $(popover_displaying_element).width(), height = $(popover_displaying_element).height();
			var center_x = element_pos.left + width/2;
			var popup_top = (element_pos.top + height + 5 + 10);
			var popup_left = 137;
					       			
			if(center_x > 137 && ($(window).width() - center_x) > 137)
				popup_left = (center_x - 137);
			else if(center_x < 137)
				popup_left = 0;
			else
				popup_left = ($(window).width() - 274);
				    				
			var arrow_left = center_x - popup_left - 7;
			$('.ui-popup-arrow-container').css('left', arrow_left +20);
			$('#typingQuizPopup').css('left', popup_left).css('top', popup_top);
			
			scroll_position_before_popup = $(document).scrollTop();
			if((popup_top - $(document).scrollTop()) > ($(window).height() - $('#typingQuizPopup').height() - 10)) {
				var scroll_to = (popup_top - ($(window).height() - $('#typingQuizPopup').height() - 10));
				$('html, body').animate({scrollTop: scroll_to}, 400);
			}
			
			showTypingQuizPopUpNew(popover_displaying_element_detail);
		}
		
		event.stopPropagation();
	});

	$('.skipSpeak').click(function(event) {
		$('#ca_popover').css('display', 'none');
		$('#typingQuizPopup').css('display', 'none');
		
		$(".replaced_word_to_popup").each(function(){
			if($(this).text().toLowerCase().trim() == popover_displaying_element_detail.meaning.toLowerCase().trim()){
				$(this).removeClass("redCandy");
				$(this).addClass("yellowCandy");
				$(this).text(popover_displaying_element_detail.word);
			}
		});
		$("#quiz_popover_text").text("Pick what '"+popover_displaying_element_detail.word+"' means");
		
		var arr = [];
		var arrOption = [];
		while(arr.length < 3){
		  var randomnumber=Math.ceil(Math.random()*3);
		  var found=false;
		  for(var i=0;i<arr.length;i++){
			  if(arr[i]==randomnumber){found=true;break;}
		  }
		  if(!found)arr[arr.length]=randomnumber;
		}
		while(arrOption.length < 3){
			  var randomnumber=Math.ceil(Math.random()*3);
			  var found=false;
			  for(var i=0;i<arrOption.length;i++){
				if(arrOption[i]==randomnumber){found=true;break;}
			  }
			  if(!found)arrOption[arr.length]=randomnumber;
			}
		
		var randomWords = twoRandomWords();
		var options = [
		               capitalizeFirstLetter(randomWords[0].meaning),
		               capitalizeFirstLetter(randomWords[1].meaning),
		               capitalizeFirstLetter(popover_displaying_element_detail.meaning.trim())
		];
		addEventForAnalytics("Learn", "click", "Quiz Popup Options: " + JSON.stringify(options), 1);
		
		$(".quizWord"+arr[0]+"Text").text(randomWords[0].meaning);
		if(randomWords[0].meaning.length > 14){
			$(".quizWord"+arr[0]+"Text").css("font-size","11px!important");
		}
		$(".quizWord"+arr[1]+"Text").text(randomWords[1].meaning);
		if(randomWords[1].meaning.length > 14){
			$(".quizWord"+arr[1]+"Text").css("font-size","11px!important");
		}
		$(".quizWord"+arr[2]+"Text").text(popover_displaying_element_detail.meaning.trim());
		if(popover_displaying_element_detail.meaning.trim().length>14){
			$(".quizWord"+arr[2]+"Text").css("font-size","11px!important");
		}
		$(".quizWord"+arr[2]+"Text").addClass("correct_quiz_answer");
		$(".quizWord"+arr[0]+"Text").addClass("incorrect_quiz_answer");
		$(".quizWord"+arr[1]+"Text").addClass("incorrect_quiz_answer");
		
		var element_pos = $(popover_displaying_element).offset();
		var width = $(popover_displaying_element).width(), height = $(popover_displaying_element).height();
		var center_x = element_pos.left + width/2;
		var popup_top = (element_pos.top + height + 5 + 10);
		var popup_left = 147;
				       			
		if(center_x > 147 && ($(window).width() - center_x) > 147)
			popup_left = (center_x - 147);
		else if(center_x < 147)
			popup_left = 0;
		else
			popup_left = ($(window).width() - 294);
			    				
		var arrow_left = center_x - popup_left - 7;
		$('.ui-popup-arrow-container').css('left', arrow_left);
		$('#quizPopup').css('left', popup_left).css('top', popup_top);
		$('#typingQuizPopup').css('left', popup_left+20).css('top', popup_top);
		$("#typingQuizPopup .ui-popup-arrow").css("left",$("#typingQuizPopup .ui-popup-arrow").position().left-20); 
		$('#quizPopup').css('display', 'block');

		scroll_position_before_popup = $(document).scrollTop();
		if((popup_top - $(document).scrollTop()) > ($(window).height() - $('#quizPopup').height() - 30)) {
			var scroll_to = (popup_top - ($(window).height() - $('#quizPopup').height() - 30));
			$('html, body').animate({scrollTop: scroll_to}, 400);
		}
		
		event.stopPropagation();
	});
	
	$(".quizWord1Text").click(function(evt) {

		if(!$(this).hasClass("quizOptionDisable")){
			if($(this).hasClass("correct_quiz_answer")) {
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Right", 1);
				$(this).css('background','#49c9af');
				$( "#quiz_popover_text" ).text('GREAT JOB!');
				$(".quizpopUpTick1").css("display","block");
				setTimeout(showTypingQuizPopUpNew(popover_displaying_element_detail), 1000);
				playQuizSound(true);
			} else {
				playQuizSound(false);
				$(this).addClass("quizOptionDisable");
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Wrong", 1);
			}
		}
		evt.stopPropagation();
	});
	
	$(".quizWord2Text").click(function(evt) {
		if(!$(this).hasClass("quizOptionDisable")){
			if($(this).hasClass("correct_quiz_answer")) {
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Right", 1);
				$(this).css('background','#49c9af');
				$( "#quiz_popover_text" ).text('GREAT JOB!');
				$(".quizpopUpTick1").css("display","block");
				setTimeout(showTypingQuizPopUpNew(popover_displaying_element_detail), 1000);
				playQuizSound(true);
			} else {
				playQuizSound(false);
				$(this).addClass("quizOptionDisable");
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Wrong", 1);
			}
		}
		evt.stopPropagation();
	});
	
	$(".quizWord3Text").click(function(evt) {
		if(!$(this).hasClass("quizOptionDisable")){
			if($(this).hasClass("correct_quiz_answer")) {
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Right", 1);
				$(this).css('background','#49c9af');
				$( "#quiz_popover_text" ).text('GREAT JOB!');
				$(".quizpopUpTick1").css("display","block");
				setTimeout(showTypingQuizPopUpNew(popover_displaying_element_detail), 1000);
				playQuizSound(true);
			} else {
				playQuizSound(false);
				$(this).addClass("quizOptionDisable");
				addEventForAnalytics("Learn", "click", "Quiz Popup: Answered Wrong", 1);
			}
		}
		evt.stopPropagation();
	});

	$(document).click(function() {
		closepopUpHighlightDivForFacebook();		
	});
};

function removeClassesFromYellowPopup() {
	$(".quizWord1Text").removeClass("incorrect_quiz_answer");
	$(".quizWord1Text").removeClass("correct_quiz_answer");
	$(".quizWord1Text").removeClass("quizOptionDisable");
	$(".quizWord2Text").removeClass("incorrect_quiz_answer");
	$(".quizWord2Text").removeClass("correct_quiz_answer");
	$(".quizWord2Text").removeClass("quizOptionDisable");
	$(".quizWord3Text").removeClass("incorrect_quiz_answer");
	$(".quizWord3Text").removeClass("correct_quiz_answer");
	$(".quizWord3Text").removeClass("quizOptionDisable");
}

function closepopUpHighlightDivForFacebook() {
	if($('#ca_popover').css('display') == 'block') {
		addEventForAnalytics("Learn", "click", "Word Popup Closed", 1);
		$('html, body').animate({scrollTop: scroll_position_before_popup}, 400);
		scroll_position_before_popup = 0;
		$('#ca_popover').css('display', 'none');
	}
	
	if($('#quizPopup').css('display') == 'block') {
		addEventForAnalytics("Learn", "click", "Quiz Popup Closed", 1);
		$('html, body').animate({scrollTop: scroll_position_before_popup}, 400);
		scroll_position_before_popup = 0;
		$('#quizPopup').css('display', 'none');
		$(popover_displaying_element).text('\u00a0' + popover_displaying_element_detail.word + '\u00a0');
		removeClassesFromYellowPopup();
		$("#quiz_popover_text").text("CHOOSE AN OPTION");
	}
	
	if($('#typingQuizPopup').css('display') == 'block') {
		addEventForAnalytics("Learn", "click", "Typing-Quiz Popup Closed", 1);
		$('html, body').animate({scrollTop: scroll_position_before_popup}, 400);
		$('#typingQuizPopup').css('display', 'none');
	}
	
	$(".quizpopUpTick1").css("display", "none");
	$(".quizpopUpTick2").css("display", "none");
	$(".quizpopUpTick3").css("display", "none");
	$('#underlinedReplacementPopup').css('display', 'none');
}

var twoRandomWords = function() {
	var tagDictionary = dictionary['Dictionary'][popover_displaying_element_detail.tag];
	var tagKeys = $.map(tagDictionary, function(v, k) { return k;});
	var randomWords = [];
	while(randomWords.length < 2) {
		var r = tagKeys[Math.floor(Math.random()*tagKeys.length)];
		
		var r_meaning = tagDictionary[r];
		if(TO_LANGUAGE == 'Mandarin' && SCRIPTING == 'Simplified')
			r_meaning = tagDictionary[r][0];
		else if(TO_LANGUAGE == 'Mandarin' && SCRIPTING == 'PinYin')
			r_meaning = tagDictionary[r][1];

		if(r_meaning.trim() != "" && ((randomWords.length == 0 &&
			r.toLowerCase().trim() != popover_displaying_element_detail.word.toLowerCase().trim() &&
			r_meaning.toLowerCase().trim() != popover_displaying_element_detail.meaning.toLowerCase().trim()) ||
			(randomWords.length == 1 &&
				r.toLowerCase().trim() != popover_displaying_element_detail.word.toLowerCase().trim() &&
				r_meaning.toLowerCase().trim() != popover_displaying_element_detail.meaning.toLowerCase().trim() &&
				r.toLowerCase().trim() != randomWords[0].word.toLowerCase().trim() &&
				r_meaning.toLowerCase().trim() != randomWords[0].meaning.toLowerCase().trim()))) {
			randomWords.push({
				tag: popover_displaying_element_detail.tag,
				word: r,
				meaning: r_meaning
			});
		}
	}

	return randomWords;
};

function showTypingQuizPopUpNew(this1) {
	$('#ca_popover').css('display', 'none');
	$('#quizPopup').css('display', 'none');
	removeClassesFromYellowPopup();
	
	$(".replaced_word_to_popup").each(function(){
		if($(this).text().toLowerCase().trim() == this1.word.toLowerCase().trim()){
			$(this).removeClass("yellowCandy").addClass("greenCandy");
		}
	});
	
	$("#typingQuizPopupHeader").text('Translate "' + this1.word.trim() + '"');
	$('#typingQuizPopupDetail > #word').text(this1.word.trim());
	$('#typingQuizPopupDetail > #meaning').text(this1.meaning.trim());
	
	$("#typingQuizPopup").css("display","block");
	$("#typingQuizPopupTextBoxInput").val('');
	$("#typingQuizPopupTextBoxInput").focus();
}

var greenPopupSubmitted =  function() {
	var t = $('#typingQuizPopupTextBoxInput').val();
	var meaning = $('#typingQuizPopupDetail > #meaning').text();
	meaning = removeSpecialCharacter(meaning);
	t = removeSpace(t);
	if(meaning.toLowerCase() == t.toLowerCase()) {
		addEventForAnalytics("Learn", "click", "Typing-Quiz Popup: Typed Correct", 1);
		playQuizSound(true);

		setTimeout(function() {
			$('#typingQuizPopupTextBoxInput').val("");
			$("#typingQuizPopup").css("display","none");
		}, 3000);
		
		removeCandy(popover_displaying_element_detail.word);
	} else {
		addEventForAnalytics("Learn", "click", "Typing-Quiz Popup: Typed Incorrect", 1);
		playQuizSound(false);
		$('#typingQuizPopupTextBoxInput').css("text-decoration","line-through");
		$("#tryAgainIntypingQuiz").css("display","block");
		setTimeout(function() {
			$('#typingQuizPopupTextBoxInput').css("text-decoration","none");
			$('#typingQuizPopupTextBoxInput').val($('#typingQuizPopupDetail > #meaning').text());
		}, 1000);

		setTimeout(function() {
			$('#typingQuizPopupTextBoxInput').val("");
			$("#tryAgainIntypingQuiz").css("display","none");
		}, 2000);
	}
};

function removeSpecialCharacter(m){
	var meaning = m ; 
	meaning = meaning.replace(/[!-.,;¡¿?'"]/g, '');
	meaning = meaning.replace(/\//g, '');
	meaning = meaning.replace(/[áāǎàĀÁǍÀ]/g,'a');
	meaning = meaning.replace(/[éēěèĒÉĚÈ]/g,'e');
	meaning = meaning.replace(/[ííīíǐìĪÍǏÌ]/g,'i');
	meaning = meaning.replace(/[óōóǒòŌÓǑÒ]/g,'o');
	meaning = meaning.replace(/[úüūúǔùǖǘǚǜŪÚǓÙǕǗǙÜ]/g,'u');
	meaning = meaning.replace(/[ññññ]/g,'n');
	meaning = meaning.replace(/[ü]/g,'u');
	meaning = meaning.replace(/^\s+|\s+$/g,'');
	
	return meaning;
}

function removeSpace(text){
	var t = text;
	t = t.replace(/[!-.,;¡¿?'"]/g, '');
	t = t.replace(/\//g, '');
	t = t.replace(/[áāǎàĀÁǍÀ]/g,'a');
	t = t.replace(/[éēěèĒÉĚÈ]/g,'e');
	t = t.replace(/[ííīíǐìĪÍǏÌ]/g,'i');
	t = t.replace(/[óōóǒòŌÓǑÒ]/g,'o');
	t = t.replace(/[úüūúǔùǖǘǚǜŪÚǓÙǕǗǙÜ]/g,'u');
	t = t.replace(/[ññññ]/g,'n');
	t = t.replace(/[ü]/g,'u');
	t = t.replace(/^\s+|\s+$/g,'');
	t = t.replace(/[!-.,;¡¿?'"]/g, '');
	t = t.replace(/\//g, '');
	return t;
}

function playQuizSound(isCorrect) {
	var sound = '';
	if(isCorrect) {
		var randomnumber = (Math.ceil(Math.random() * 7));
		sound = 'correct_Sound/correct_sound' + randomnumber + '.mp3';
	} else {
		var randomnumber = (Math.ceil(Math.random() * 5));
		sound = 'Incorrect_Sound/incorrect_sound' + randomnumber + '.mp3';
	}
	
	$('<audio id="ca_quiz_feedback_player" src="https://s3.amazonaws.com/learnor_images/common_assets/audio_temp_quiz/' + sound + '"></audio>')[0].play();
}

function removeCandy(text) {
	startAnimation();
	
	setTimeout(function() {
		closepopUpHighlightDivForFacebook();
	}, 500);

	var word = '', meaning = '';
	$('.replaced_word_to_popup').each(function() {
		if($(this).text().trim().toLowerCase() == text.trim().toLowerCase()) {
			var element = $(this);
			$(element).before($('<span class="completed-word" ' +
									   'style="border-bottom: 1px solid #49c9af;" ' +
									   'ln="' + $(this).attr('ln') + '" ' +
									   'word="' + $(element).text().trim() + '" ' +
									   'meaning="' + $(this).attr("meaning").trim() + '" ' +
									   'category="' + $(element).attr('category') + '">' +
									   		$(this).text().trim() +
								'</span>'));
			$(element).remove();
			$(this).remove();
			
			meaning = $(this).attr('meaning').trim().toLowerCase();
			word = $(this).attr('word').trim().toLowerCase();
		}
	});
	$(".completed-word").click(function(evt){
		showUnderlinedReplacementPopup(this, evt);
		evt.stopPropagation();
	});
	
	if(word != '') {
		updateUserWordsInDatabase(word, meaning);
	}
	
	if(cultureAlleyUserData != undefined) {
		updateJelliesInDatabase({
			userId: cultureAlleyUserData.userId,
			type: 'red',
			count: 1,
			nativeLang: capitalizeFirstLetter(FROM_LANGUAGE),
			learningLang: capitalizeFirstLetter(TO_LANGUAGE)
		});
	} else {
		updateJelliesInDatabase();
	}
}

function startAnimation() {
	$(".animatedJellyContainer").css("display","block");
	$(".animatedJellyContainer").css("top",$("#typingQuizPopup").offset().top - 50);
	$(".animatedJellyContainer").css("left",$("#typingQuizPopup").offset().left + 137);
	setTimeout(function(){
		var top = ($('.headerJellyJar').offset().top - $('.animatedJellyContainer').offset().top + 12)+"px";
		var left = ($('.headerJellyJar').offset().left - $('.animatedJellyContainer').offset().left -10)+"px";
		$(".animatedJellyContainer").css("-webkit-transform","translate3d("+left+","+top+",0px ) rotateZ(93deg)");
		$(".animatedJellyContainer").css("transform","translate3d("+left+","+top+" ,0px) rotateZ(93deg)");
		setTimeout(function(){$(".animatedJelly").addClass('goIntoJarReducingSize'); $('.jellyHalo').addClass('jellyHaloGlow');},1200);
		setTimeout(function(){
			$(".animatedJellyContainer").css('display','none');
			$('.jellyHalo').removeClass('jellyHaloGlow');
		 $('.headerJellyJarImage').addClass('tada');
		},2200);

		setTimeout(function(){$('.headerJellyJarImage').removeClass('tada');},3200);
		setTimeout(function(){
			$(".animatedJellyContainer").css("-webkit-transform","none");
			$(".animatedJellyContainer").css("transform","none");
			$(".animatedJelly").removeClass('goIntoJarReducingSize');
		},4000);
	},500);
}

function updateJelliesInDatabase(data) {
	if(data == undefined) {
		chrome.storage.sync.set({
			temporaryJellies: JSON.stringify(++temporaryJellies)
		}, function() {
			chrome.storage.sync.get('jelliesEarnedSinceLastSignupLaterClicked', function(items) {
				console.log('items.jelliesEarnedSinceLastSignupLaterClicked:', items.jelliesEarnedSinceLastSignupLaterClicked);
				if(items.jelliesEarnedSinceLastSignupLaterClicked != undefined) {
					var v = parseInt(items.jelliesEarnedSinceLastSignupLaterClicked) + 1;
					chrome.storage.sync.set({jelliesEarnedSinceLastSignupLaterClicked: v.toString()}, function() {
						setTimeout(function(){
							updateJelliesInUI();
						},2000);
					});
				}else{
					setTimeout(function(){
							updateJelliesInUI();
						},3000);
				}
			});
		});
	} else {
		$.getJSON(siteUrl + '/updatedJellies.action', data)
		.fail(function(a, b, c) {
			console.log("updateJelliesInDatabase Error:", a, b, c);
		})
		.always(function(a, b) {
			getEarnedCandies(capitalizeFirstLetter(data.nativeLang), capitalizeFirstLetter(data.learningLang));
		});
	}
}

function showSignupPopup() {
	var center = {
			x: ($(window).width() - 450)/2,
			y: ($(window).height() - 320)/2
		};
	$('#ca_signup_popover').css('top', center.y);
	$('#ca_signup_popover').css('left', center.x);
	$('#ca_signup_popover').css('display', '');
	
	var size = {
		width: $(document).width(),
		height: $(document).height()
	};
	$('#ca_signup_popover_curtain').css('width', size.width);
	$('#ca_signup_popover_curtain').css('height', size.height);
	$('#ca_signup_popover_curtain').css('display', '');
}

function hideSignupPopup() {
	chrome.storage.sync.set({jelliesEarnedSinceLastSignupLaterClicked: '0'});
	$('#ca_signup_popover').css('display', 'none');
	$('#ca_signup_popover_curtain').css('display', 'none');
}

function updateJelliesInUI() {
	var totalJellies = 0;
	if(!(cultureAlleyUserData != undefined && cultureAlleyUserData.jellies != undefined)) {
		totalJellies = temporaryJellies;
		console.log(totalJellies);
		if(temporaryJellies >= 5) {
			chrome.storage.sync.get('jelliesEarnedSinceLastSignupLaterClicked', function(items) {
				console.log('items.jelliesEarnedSinceLastSignupLaterClicked:', items.jelliesEarnedSinceLastSignupLaterClicked);
				if(items.jelliesEarnedSinceLastSignupLaterClicked == undefined ||
						items.jelliesEarnedSinceLastSignupLaterClicked == 5)
					showSignupPopup();
			});
		}
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

	$('.scorePoint').text(totalJellies);
	setBadge(totalJellies);
}

function getEarnedCandies(from , to) {
	if(from == undefined || to == undefined) return;
	if(cultureAlleyUserData == undefined) {
		updateJelliesInUI();
	} else {
		$.getJSON(siteUrl + '/earnedJellies.action', {
			userId: cultureAlleyUserData.userId
		})
		.done(function(r) {
			if(r.error == undefined) {
				cultureAlleyUserData.jellies = r.data;
				chrome.storage.sync.set({
					cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)
				}, function() {
					setTimeout(function(){
						updateJelliesInUI();
					},1200);
					
					chrome.runtime.sendMessage({
						method: 'updateJelliesInUI',
						cultureAlleyUserData: cultureAlleyUserData
					});
				});
			} else {
				console.log('Jellies-Fetch Error:', r.error);
			}
		})
		.fail(function(a, b, c) {
			console.log("getEarnedCandies Error:", a, b, c);
		});
	}
}

function updateUserWordsInDatabase(englishWord, word) {
	if(cultureAlleyUserData == undefined) {
		var exists = false, i = 0;
		temporaryWords = temporaryWords || [];
		for(; i<temporaryWords.length; i++) {
			var ith = temporaryWords[i];
			if(decodeURIComponent(ith.word).trim().toLowerCase() == englishWord.trim().toLowerCase() &&
					decodeURIComponent(ith.meaning).trim().toLowerCase() == word.trim().toLowerCase()) {
				exists = true;
				break;
			}
		}
		
		if(!exists) {
			temporaryWords.push({
				word: englishWord,
				meaning: word,
				score: 20
			});
		} else {
			temporaryWords[i] = {
					word: englishWord,
					meaning: word,
					score: temporaryWords[i].score + 20
				};
		}
		chrome.storage.sync.set({
			temporaryWords: JSON.stringify(temporaryWords)
		}, function() {
			// updateUserWordsInUI();
		});
	} else {
		$.getJSON(siteUrl + '/updateUserWordsList.action', {
			userId: cultureAlleyUserData.userId,
			nativeLanguageId: cultureAlleyLanguageId(FROM_LANGUAGE),
			learningLanguageId: cultureAlleyLanguageId(TO_LANGUAGE),
			word: encodeURIComponent(englishWord),
			meaning: encodeURIComponent(word)
		}).done(function(dataNew) {
			if(dataNew.error == undefined) {
				var exists = false, i = 0;
				if(cultureAlleyUserData.userWords == undefined) cultureAlleyUserData.userWords = [];
				for(; i<cultureAlleyUserData.userWords.length; i++) {
					var ith = cultureAlleyUserData.userWords[i];
					if(decodeURIComponent(ith.word).trim().toLowerCase() == englishWord.trim().toLowerCase() &&
							decodeURIComponent(ith.meaning).trim().toLowerCase() == word.trim().toLowerCase()) {
						exists = true;
						break;
					}
				}
				if(!exists) {
					cultureAlleyUserData.userWords.push({
						word: englishWord,
						meaning: word,
						score: 20
					});
				} else {
					cultureAlleyUserData.userWords[i] = {
							word: englishWord,
							meaning: word,
							score: cultureAlleyUserData.userWords[i].score + 20
						};
				}
				chrome.storage.sync.set({
					cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)
				}, function() {
					// updateUserWordsInUI();
				});
			}
		});
	}
}

function getUserWords() {
	if(cultureAlleyUserData == undefined) return;
	$.getJSON(siteUrl + '/fetchUserWords.action', {
		userId: cultureAlleyUserData.userId,
		nativeLanguageId: cultureAlleyLanguageId(FROM_LANGUAGE),
		learningLanguageId: cultureAlleyLanguageId(TO_LANGUAGE)
	}).done(function(dataNew) {
		if(dataNew.error == undefined) {
			cultureAlleyUserData.userWords = dataNew.data;
			chrome.storage.sync.set({
				cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)
			}, function() {
				chrome.runtime.sendMessage({
					method: 'updateUserWordsInUI',
					cultureAlleyUserData: cultureAlleyUserData
				});
			});
		}
	});
}

function retrieveStreaks() {
	if(cultureAlleyUserData == undefined) return;
	$.getJSON(siteUrl + '/getStreakDetail.action', {
		userId: cultureAlleyUserData.userId
	}).done(function(r) {
		if(r.error == undefined) {
			cultureAlleyUserData.streaks = r;
			chrome.storage.sync.set({cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)});
			calculateStreaks();
		} else {
			console.log('error:', r.error);
		}
	});
}

function updateStreaks(streaks) {
	if(cultureAlleyUserData == undefined) return;
	$.getJSON(siteUrl + '/updateStreakDetail.action', {
		userId: cultureAlleyUserData.userId,
		lastLogin: new Date().getTime(),
		count: streaks,
	})
	.done(function(r) {
		if(r.error == undefined) {
			cultureAlleyUserData.streaks = r;
			chrome.storage.sync.set({cultureAlleyUserData: JSON.stringify(cultureAlleyUserData)});
		} else
			console.log('Error in updating streaks:', r.error);
	})
	.always(function(x, s) {
		calculateStreaks();
	});
}

function calculateStreaks() {
	var s = cultureAlleyUserData.streaks;
	
	if(s == undefined || s.lastLogin == 0) {
		updateStreaks(1);
	} else {
		var ll = new Date(s.lastLogin);
		if(isToday(ll)) {
			// Do nothing.
		} else if(isPreviousDay(ll)) {
			updateStreaks(++(s.count));
		} else {
			updateStreaks(1);
		}
	}
}

function isToday(theDay) {
	if(!(theDay instanceof Date)) return false;
	var c = new Date();
	var dd = c.getDate() - theDay.getDate();
	var md = c.getMonth() - theDay.getMonth();
	var yd = c.getFullYear() - theDay.getFullYear();
	
	if(yd == 0 && md == 0 && dd == 0) {
		return true;
	}
	return false;
}

function isPreviousDay(theDay) {
	if(!(theDay instanceof Date)) return false;
	var c = new Date();
	var dd = c.getDate() - theDay.getDate();
	var md = c.getMonth() - theDay.getMonth();
	var yd = c.getFullYear() - theDay.getFullYear();
	
	if(yd == 0 && md == 0 && dd == 1) {
		return true;
	} else if(yd == 1 && md == -11 && dd == -30 && theDay.getDate() == 31) {
		return true;
	} else if(yd == 0 && md == 1) {
		var _30DayMonths = [3, 5, 8, 10];
		if(theDay.getMonth() == 1 && ((dd == -27 && theDay.getDate() == 28) || (dd == -28 && theDay.getDate() == 29))) {
			return true;
		} else {
			var _30DayMonth = false;
			for(var i=0; i<_30DayMonths.length; i++) {
				if(theDay.getMonth() == _30DayMonths[i]) {_30DayMonth = true; break;}
			}
			if(_30DayMonth) {
				if(dd == -29 && theDay.getDate() == 30) return true;
			} else {
				if(dd == -30 && theDay.getDate() == 31) return true;
			}
		}
	}
	return false;
}

function capitalizeFirstLetter(str) {
	if(typeof str !== 'string') return;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
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

function setBadge(badgeText) {
	chrome.runtime.sendMessage({method: 'setBadge', text: badgeText.toString()}, function(r) {});
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