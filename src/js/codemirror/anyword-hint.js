// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE
(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function(CodeMirror) {
        "use strict";

        var WORD = /[\p{Letter}\p{Number}_:]+/u,
            RANGE = 500;

        var PRELUDE_COMMAND_WORDS = [
            "METADATA",//tag
			['author', 'Gill Bloggs'],
			['author_color', 'blue'],
			['color_palette', 'arne'],
			['again_interval', '0.1'],
			['background_color', 'blue'],
			['debug', ''],
			['flickscreen', '8x5'],
			['homepage', 'www.puzzlescript.net'],
			['keyhint_color', 'brown'],
			['key_repeat_interval', '0.1'],
			['noaction', ''],
			['norepeat_action', ''],
			['noundo', ''],
			['norestart', ''],
			['realtime_interval', ''],
			['require_player_movement', ''],
			['run_rules_on_level_start', ''],
			['sprite_size', 'WxH'],
			['text_color', 'orange'],
			['title', 'My Amazing Puzzle Game'],
			['title_color', 'blue'],
			['throttle_movement', ''],
			['zoomscreen', 'WxH'],
        ];
        const color_keywords = [ 'author_color', 'background_color', 'keyhint_color', 'text_color', 'title_color' ]

        var COLOR_WORDS = [
            "COLOR",//special tag
            "black", "white", "darkgray", "lightgray", "gray", "red", "darkred", "lightred", "brown", "darkbrown", "lightbrown", "orange", "yellow", "green", "darkgreen", "lightgreen", "blue", "lightblue", "darkblue", "purple", "pink", "transparent"];
        var RULE_COMMAND_WORDS = [
            "COMMAND",
            "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5", "sfx6", "sfx7", "sfx8", "sfx9", "sfx10", "cancel", "checkpoint", "restart", "win", "message", "again"];

        var CARDINAL_DIRECTION_WORDS = [
            "DIRECTION",
            "up","down","left","right","horizontal","vertical"]

        var RULE_DIRECTION_WORDS = [
            "DIRECTION",//tag
            "up", "down", "left", "right", "random", "horizontal", "vertical","late","rigid"]

        var LOOP_WORDS = [
            "BRACKET",//tag
            "startloop","endloop"]
            
        var PATTERN_DIRECTION_WORDS = [
            "DIRECTION",
            "up", "down", "left", "right", "moving", "stationary", "no", "randomdir", "random", "horizontal", "vertical", "orthogonal", "perpendicular", "parallel", "action"]

        var SOUND_WORDS = [
            "SOUNDVERB",
            'gamescreen', 'pausescreen', "startgame", "cancel", "endgame", "startlevel", "undo", "restart", "endlevel", "showmessage", "closemessage", "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5", "sfx6", "sfx7", "sfx8", "sfx9", "sfx10", "create", "destroy", "move", "cantmove", "action"];

        var WINCONDITION_WORDS = [
            "LOGICWORD",
            "some", "on", "no", "all"]

        var LEGEND_LOGICWORDS = [
                "LOGICWORD",
                "and","or"
            ]

        var PRELUDE_COLOR_PALETTE_WORDS = [
            "mastersystem", "gameboycolour", "amiga", "arnecolors", "famicom", "atari", "pastel", "ega", "amstrad", "proteus_mellow", "proteus_rich", "proteus_night", "c64", "whitingjp"
        ]

        function renderHint(elt,data,cur)
        {
            var t1=cur.text;
            var t2=cur.extra;
            var tag=cur.tag;
            if (t1.length==0){
                t1=cur.extra;
                t2=cur.text;
            }
            var wrapper = document.createElement("span")
            wrapper.className += " cm-s-midnight cm-s-midday-hint ";

            var h = document.createElement("span"); // Create a <h1> element
            var t = document.createTextNode(t1);    // Create a text node

            h.appendChild(t);   
            wrapper.appendChild(h); 

            if (tag!=null){
                h.className += "cm-" + tag;
            }

            elt.appendChild(wrapper);//document.createTextNode(cur.displayText || getText(cur)));

            if (t2.length>0){
                var h2 = document.createElement("span")                // Create a <h1> element
                h2.style.color="orange";
                var t2 = document.createTextNode(" "+t2);     // Create a text node
                h2.appendChild(t2);  
                h2.style.color="orange";
                elt.appendChild(t2);
            }
        }

        CodeMirror.registerHelper("hint", "anyword", function(editor, options)
        {
            var word = options && options.word || WORD;
            var range = options && options.range || RANGE;
            var cur = editor.getCursor(),
                curLine = editor.getLine(cur.line);

            var end = cur.ch,
                start = end;

            var lineToCursor = curLine.substr(0,end);

            while (start && word.test(curLine.charAt(start - 1)))
                --start;
            var curWord = (start != end) && curLine.slice(start, end);

            var current_token = editor.getTokenAt(cur)
            var state = current_token.state

            // ignore empty word
            if (!curWord || state.commentLevel>0)
            {
                // if ( 
                //         ( state.section=="" && curLine.trim()=="")  
                //         // || ( state.section=="objects" && state.objects_section==2 ) 
                //     ) {
                //     curWord="";
                // } else {
                    return {
                        list: []
                    };
                // }            
            }

            var addTags = false;
            var addTagsAfterSemicolon = false;
            var addObjects = false;
            var excludeProperties = false;
            var excludeAggregates = false;
            var candlists = [];
            switch (state.section) {
                case 'tags':
                    {
                        addTags = true;
                        break;
                    }
                case 'objects':
                    {
                        addTagsAfterSemicolon = true;
                        if (state.objects_section==2){
                            candlists.push(COLOR_WORDS);
                        }
                        break;
                    }
                case 'legend':
                    {
                        if (lineToCursor.indexOf('=')>=0){
                            const tokindex = lineToCursor.trim().split(/\s+/ );
                            if ((tokindex.length%2)===1){
                                addObjects=true;
                                addTagsAfterSemicolon = true;
                            } else {
                                candlists.push(LEGEND_LOGICWORDS);                      
                            }
                        } //no hints before equals
                        break;
                    }
                case 'sounds':
                    {
                        candlists.push(CARDINAL_DIRECTION_WORDS);
                        candlists.push(SOUND_WORDS);
                        addObjects=true;
                        excludeAggregates=true;
                        break;
                    }
                case 'collisionlayers':
                    {
                        addObjects=true;
                        break;
                    }
                case 'rules':
                    {   
                        //if inside of roles,can use some extra directions
                        if (lineToCursor.indexOf("[")==-1) {
                            candlists.push(RULE_DIRECTION_WORDS);
                            candlists.push(LOOP_WORDS);
                        } else {
                            candlists.push(PATTERN_DIRECTION_WORDS);                            
                        }
                        if (lineToCursor.indexOf("->")>=0) {
                            candlists.push(RULE_COMMAND_WORDS);
                        }
                        addObjects=true;
                        break;
                    }
                case 'winconditions':
                    {
                        if ((lineToCursor.trim().split(/\s+/ ).length%2)===0){
                            addObjects=true;
                        }
                        candlists.push(WINCONDITION_WORDS);
                        break;
                    }
                case 'levels':
                    {
                        if ("message".indexOf(lineToCursor.trim())===0) {
                            candlists.push(["MESSAGE_VERB","message"]);
                        }
                        break;
                    }
                default: //preamble
                    {
                        var lc = lineToCursor.toLowerCase();
                        if (color_keywords.some( c => lc.includes(c) ) ) {
                            candlists.push(COLOR_WORDS);
                        } else {
                            var linewords =lineToCursor.trim().split(/\s+/ );

                            if (linewords.length<2) {
                                candlists.push(PRELUDE_COMMAND_WORDS);
                            } else if (linewords.length==2 && linewords[0].toLowerCase()=='color_palette'){
                                candlists.push(PRELUDE_COLOR_PALETTE_WORDS);
                            }
                        }

                        break;
                    }
            }

            var curTag = curWord;
            var curTagPrefix = '';
            const semicolon_pos = curWord.lastIndexOf(':');
            if (addTagsAfterSemicolon && (semicolon_pos >= 0) )
            {
                addTags = true;
                curTagPrefix = curWord.substr(0, semicolon_pos+1);
                curTag = curWord.substr(semicolon_pos+1);
            }

            // case insensitive
            curWord = curWord.toLowerCase();
            curTag = curTag.toLowerCase();

            var list = options && options.list || [];
            var seen = new Set();


            if (addTags)
            {
                for (const [identifier_index, w] of state.identifiers.names.entries())
                {
                    if ([identifier_type_tag, identifier_type_tagset].includes(state.identifiers.deftype[identifier_index]))
                    {
                        const matchWord = curTagPrefix.toLowerCase()+w.toLowerCase();
                        // if (matchWord === curTag) continue;
                        if ((!curTag || matchWord.lastIndexOf(curTag, 0) == 0) && !seen.has(matchWord))
                        {
                            seen.add(matchWord);
                            const hint = curTagPrefix+state.identifiers.original_case_names[identifier_index];
	                        // console.log('adding '+matchWord+' as tag -> '+hint)
                            list.push({text:hint, extra:'', tag:'NAME', render:renderHint})
                        }
                    }
                }
            }

            //first, add objects if needed
            if (addObjects)
            {
                for (const [object_index, o] of state.identifiers.objects.entries())
                {
                    const w = o.name;
                    var matchWord = w.toLowerCase();
                    // if (matchWord === curWord) continue;
                    if ((!curWord || matchWord.lastIndexOf(curWord, 0) == 0) && !seen.has(matchWord))
                    {
                        seen.add(matchWord);
                        // console.log('adding '+matchWord+' as object')
                        const hint = state.identifiers.original_case_names[o.identifier_index]
                        list.push({text:hint, extra:'', tag:'NAME', render:renderHint})
                    }
                }

                var legendbits_types = [ identifier_type_synonym ];
                if ( !excludeProperties )
                {
                    legendbits_types.push(identifier_type_property);
                }
                if ( !excludeAggregates )
                {
                    legendbits_types.push(identifier_type_aggregate);
                }

                //go through all derived objects
                for (const [identifier_index, w] of state.identifiers.names.entries())
                {
                    if (legendbits_types.includes(state.identifiers.deftype[identifier_index]))
                    {
                        const matchWord = w.toLowerCase();
                        // if (matchWord === curWord) continue;
                        if ((!curWord || matchWord.lastIndexOf(curWord, 0) == 0) && !seen.has(matchWord)) {
                            seen.add(matchWord);
	                        // console.log('adding '+matchWord+' as derived object')
                            const hint = state.identifiers.original_case_names[identifier_index];
                            list.push({text:hint,extra:"",tag:"NAME",render:renderHint});
                        }
                    }
                }

            }

            // go through random names
            for (const candlist of candlists)
            {
                const tag = candlist[0]
                for (var j = 1; j < candlist.length; j++)
                {
                    var m = candlist[j]
                    var extra = ''
                    if (typeof m !== 'string')
                    {
                        if (m.length > 1)
                        {
                            extra = m[1]
                        }
                        m = m[0]
                    }
                    const matchWord = m.toLowerCase()
                    if ( (curWord && matchWord.lastIndexOf(curWord, 0) != 0) || seen.has(matchWord) )
                    	continue
                    seen.add(matchWord)
                    // console.log('adding "'+matchWord+'" as random name for "'+curWord+'" '+(!curWord)+' '+matchWord.lastIndexOf(curWord, 0))
                    const mytag = (tag === 'COLOR') ? 'COLOR-' + m.toUpperCase() : tag
                    list.push({text:m, extra:extra, tag:mytag, render:renderHint})
                }
            }

			//if list is a single word and that matches what the current word is, don't show hint
			if ( (list.length === 1) && (list[0].text.toLowerCase() === curWord) )
			{
				list = []
			}
			//if list contains the word that you've typed, put it to top of autocomplete list
			for (var i=1; i<list.length; i++)
			{
				if (list[i].text.toLowerCase() === curWord)
				{
					const newhead = list[i]
					list.splice(i, 1)
					list.unshift(newhead)
					break
				}
			}
			//if you're editing mid-word rather than at the end, no hints.
			if (current_token.string.trim().length > curWord.length)
			{
				list = []
			}

            return {
                list: list,
                from: CodeMirror.Pos(cur.line, start),
                to: CodeMirror.Pos(cur.line, end)
            };
        });

    // https://statetackoverflow.com/questions/13744176/codemirror-autocomplete-after-any-keyup
    CodeMirror.ExcludedIntelliSenseTriggerKeys = {
        "9": "tab",
        "13": "enter",
        "16": "shift",
        "17": "ctrl",
        "18": "alt",
        "19": "pause",
        "20": "capslock",
        "27": "escape",
        "33": "pageup",
        "34": "pagedown",
        "35": "end",
        "36": "home",
        "37": "left",
        "38": "up",
        "39": "right",
        "40": "down",
        "45": "insert",
        "91": "left window key",
        "92": "right window key",
        "93": "select",
        "107": "add",
        "109": "subtract",
        "110": "decimal point",
        "111": "divide",
        "112": "f1",
        "113": "f2",
        "114": "f3",
        "115": "f4",
        "116": "f5",
        "117": "f6",
        "118": "f7",
        "119": "f8",
        "120": "f9",
        "121": "f10",
        "122": "f11",
        "123": "f12",
        "144": "numlock",
        "145": "scrolllock",
        "186": "semicolon",
        "187": "equalsign",
        "188": "comma",
        "189": "dash",
        "190": "period",
        "191": "slash",
        "192": "graveaccent",
        "220": "backslash",
        "222": "quote"
    }
});
