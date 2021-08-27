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

        const WORD = /[\p{Letter}\p{Number}_:]+/u
        const RANGE = 500

        const PRELUDE_COMMAND_WORDS = [
            "METADATA",//tag
			['author', 'Gill Bloggs'],
			['author_color', 'blue'],
			['color_palette', 'arne'],
			['again_interval', '0.1'],
			['background_color', 'blue'],
			'debug',
			['flickscreen', '8x5'],
			['homepage', 'www.puzzlescript.net'],
			['keyhint_color', 'brown'],
			['key_repeat_interval', '0.1'],
			'noaction',
			'norepeat_action',
			'noundo',
			'norestart',
			'realtime_interval',
			'require_player_movement',
			'run_rules_on_level_start',
			['sprite_size', 'WxH'],
			['text_color', 'orange'],
			['title', 'My Amazing Puzzle Game'],
			['title_color', 'blue'],
			'throttle_movement',
			['zoomscreen', 'WxH'],
        ];
        const color_keywords = [ 'author_color', 'background_color', 'keyhint_color', 'text_color', 'title_color' ]

        const COLOR_WORDS = [
            "COLOR",//special tag
            "black", "white", "darkgray", "lightgray", "gray", "red", "darkred", "lightred", "brown", "darkbrown", "lightbrown", "orange", "yellow", "green", "darkgreen", "lightgreen", "blue", "lightblue", "darkblue", "purple", "pink", "transparent"];
        const RULE_COMMAND_WORDS = [
            "COMMAND",
            "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5", "sfx6", "sfx7", "sfx8", "sfx9", "sfx10", "cancel", "checkpoint", "restart", "win", "message", "again"];

        const CARDINAL_DIRECTION_WORDS = [
            "DIRECTION",
            "up","down","left","right","horizontal","vertical"]

        const RULE_DIRECTION_WORDS = [
            "DIRECTION",//tag
            "up", "down", "left", "right", "random", "horizontal", "vertical","late","rigid"]

        const LOOP_WORDS = [
            "BRACKET",//tag
            "startloop","endloop"]
            
        const PATTERN_DIRECTION_WORDS = [
            "DIRECTION",
            "up", "down", "left", "right", "moving", "stationary", "no", "randomdir", "random", "horizontal", "vertical", "orthogonal", "perpendicular", "parallel", "action"]

        const SOUND_WORDS = [
            "SOUNDVERB",
            'gamescreen', 'pausescreen', "startgame", "cancel", "endgame", "startlevel", "undo", "restart", "endlevel", "showmessage", "closemessage", "sfx0", "sfx1", "sfx2", "sfx3", "sfx4", "sfx5", "sfx6", "sfx7", "sfx8", "sfx9", "sfx10", "create", "destroy", "move", "cantmove", "action"];

        const WINCONDITION_WORDS = [
            "LOGICWORD",
            "some", "on", "no", "all"]

        const LEGEND_LOGICWORDS = [
                "LOGICWORD",
                "and","or"
            ]

        const PRELUDE_COLOR_PALETTE_WORDS = [
            "mastersystem", "gameboycolour", "amiga", "arnecolors", "famicom", "atari", "pastel", "ega", "amstrad", "proteus_mellow", "proteus_rich", "proteus_night", "c64", "whitingjp"
        ]

        function renderHint(elt, data, cur)
        {
			var t1 = cur.text
			var t2 = cur.extra
			var tag = cur.tag

			var h = document.createElement('span') // Create a <h1> element
			var t = document.createTextNode(t1)    // Create a text node
			h.appendChild(t)

			if (tag !== null)
			{
				h.className += 'cm-' + tag
			}

			var wrapper = document.createElement('span')
			wrapper.className += ' cm-s-midnight cm-s-midday-hint '
			wrapper.appendChild(h)
			elt.appendChild(wrapper)

			if (t2.length > 0)
			{
				// TODO: that code looks suspicious to me
				var h2 = document.createElement('span') // Create a <h1> element
				h2.style.color = 'orange'
				var t2 = document.createTextNode(' '+t2) // Create a text node
				h2.appendChild(t2)
				h2.style.color = 'orange'
				elt.appendChild(t2)
			}
        }

		function list_identifiers(state, def_types, curWord, seen, list)
		{
			for (const [identifier_index, w] of state.identifiers.names.entries())
			{
				if ( ! def_types.includes(state.identifiers.deftype[identifier_index]) )
					continue

				const matchWord = w.toLowerCase()
				if ((curWord && matchWord.lastIndexOf(curWord, 0) !== 0) || seen.has(matchWord))
					continue

				seen.add(matchWord)
				const hint = state.identifiers.original_case_names[identifier_index]
				list.push({text: hint, extra: '', tag: 'NAME', render: renderHint})
			}
		}

		function list_possible_tags(state, tag_def_types, curTag, obj_deftypes, curTagPrefix, seen, list)
		{
			for (const [identifier_index, w] of state.identifiers.names.entries())
			{
				if ( ! tag_def_types.includes(state.identifiers.deftype[identifier_index]) )
					continue

				const matchWord = w.toLowerCase()
				if ((curTag && matchWord.lastIndexOf(curTag, 0) !== 0) || seen.has(matchWord))
					continue

				// check that some object exists for that tag
				const obj_name_start = curTagPrefix.toLowerCase() + matchWord
				if ( ! state.identifiers.names.some( (n, ii) => (n.startsWith(obj_name_start) && obj_deftypes.includes(state.identifiers.deftype[ii])) ) )
					continue

				seen.add(matchWord)
				const hint = state.identifiers.original_case_names[identifier_index]
				list.push({text: hint, extra: '', tag: 'NAME', render: renderHint})
			}
		}

        CodeMirror.registerHelper("hint", "anyword", function(editor, options)
        {
            var word = options && options.word || WORD;
            var range = options && options.range || RANGE;
            var cursor = editor.getCursor()
            var curLine = editor.getLine(cursor.line)

            const lineToCursor = curLine.substr(0, cursor.ch)

            var end = cursor.ch
            var start = end
            while (start && word.test(curLine.charAt(start - 1)))
                --start;
            var curWord = (start != end) && curLine.slice(start, end)

            var current_token = editor.getTokenAt(cursor)
            var state = current_token.state

            // ignore empty word + if you're editing mid-word rather than at the end, no hints.
            if ( (! curWord) || (state.commentLevel > 0) || (current_token.string.trim().length > curWord.length) )
                return { list: [] }

            var addTags = false
            var addObjects = false
            var addTagsAfterSemicolon = false // should we add the tags in an object name? We should always do it if addObjects is true and we are after a semicolon, but we
                                              // should also do it in object definitions when addObjects is false.
            var addMappings = false
            var excludeProperties = false
            var excludeAggregates = false
            var candlists = []
            switch (state.section)
            {
                case 'tags':
					addTags = true
					break
                case 'objects':
					switch (state.objects_section)
					{
					case 3:
						addObjects = true // for 'copy:'. TODO: we should only set it to true if we are right after 'copy:'. Also, we should add the transformation keywords.
						addMappings = true
						break
					case 2:
						candlists.push(COLOR_WORDS)
						break
					case 0:
					case 1:
					default:
						addTagsAfterSemicolon = true
					}
					break
                case 'mappings':
                	// TODO
                	break
                case 'legend':
					if (lineToCursor.indexOf('=') >= 0)
					{
						const tokindex = lineToCursor.trim().split(/\s+/ )
						if ((tokindex.length % 2) === 1)
						{
							addObjects = true
							addTagsAfterSemicolon = true
						} else {
							candlists.push(LEGEND_LOGICWORDS)
						}
					} //no hints before equals
					break
                case 'sounds':
					candlists.push(CARDINAL_DIRECTION_WORDS)
					candlists.push(SOUND_WORDS)
					addObjects = true
					excludeAggregates = true
					break
                case 'collisionlayers':
					addObjects = true // TODO: add tags if at beginning or before an arrow
					addMappings = true
					break
                case 'rules':
					if (lineToCursor.indexOf('[') == -1) {
						candlists.push(RULE_DIRECTION_WORDS);
						candlists.push(LOOP_WORDS);
					} else {
						candlists.push(PATTERN_DIRECTION_WORDS);                            
					}
					if (lineToCursor.indexOf('->') >= 0) {
						candlists.push(RULE_COMMAND_WORDS);
					}
					addObjects = true
					addMappings = true
					break
                case 'winconditions':
					if ( (lineToCursor.trim().split(/\s+/).length % 2) === 0)
					{
						addObjects = true
					}
					candlists.push(WINCONDITION_WORDS)
					break
                case 'levels':
					if ('message'.indexOf(lineToCursor.trim()) === 0)
					{
						candlists.push(['MESSAGE_VERB', 'message'])
					}
					break
                default: //preamble
					var lc = lineToCursor.toLowerCase()
					if (color_keywords.some( c => lc.includes(c) ) )
					{
						candlists.push(COLOR_WORDS)
					}
					else
					{
						const linewords =lineToCursor.trim().split(/\s+/ )
						if (linewords.length < 2)
						{
							candlists.push(PRELUDE_COMMAND_WORDS)
						}
						else if (linewords.length == 2 && linewords[0].toLowerCase() == 'color_palette')
						{
							candlists.push(PRELUDE_COLOR_PALETTE_WORDS)
						}
					}
            }

            var curTag = curWord
            var curTagPrefix = ''
            const semicolon_pos = curWord.lastIndexOf(':')
            if ( (semicolon_pos >= 0) && (addTagsAfterSemicolon||addObjects) )
            {
            	start += semicolon_pos+1
                curTagPrefix = curWord.substr(0, semicolon_pos+1)
                curTag = curWord.substr(semicolon_pos+1)
            }

            // case insensitive
            curWord = curWord.toLowerCase()
            curTag = curTag.toLowerCase()

            var list = options && options.list || [];
            var seen = new Set()

            if (addTags)
            {
				list_identifiers(state, [identifier_type_tag, identifier_type_tagset], curWord, seen, list)
            }

            // find the set of acceptable identifiers deftypes
			var legendbits_types = [ identifier_type_synonym ]
			if ( ! excludeProperties )
			{
				legendbits_types.push(identifier_type_property)
			}
			if ( ! excludeAggregates )
			{
				legendbits_types.push(identifier_type_aggregate)
			}

            if (addObjects && (semicolon_pos < 0) )
            {
				// first, add objects if needed
				list_identifiers(state, [identifier_type_object], curWord, seen, list)
                // then add other accepted types
				list_identifiers(state, legendbits_types, curWord, seen, list)
            }
            else if ( (addTagsAfterSemicolon||addObjects) && (semicolon_pos >= 0))
            {
            	// first add tags for which an object has been defined
            	// TODO: predefined tags, tag sets, and tag mappings (directional keywords) should come after the user-defined ones.
				list_possible_tags(state, [identifier_type_tagset],  curTag, legendbits_types, curTagPrefix, seen, list)
				list_possible_tags(state, [identifier_type_tag],     curTag, legendbits_types, curTagPrefix, seen, list)
				list_possible_tags(state, [identifier_type_mapping], curTag, legendbits_types, curTagPrefix, seen, list)
				// then add all other tags
				list_identifiers(state, [identifier_type_tagset],  curTag, seen, list)
				list_identifiers(state, [identifier_type_tag],     curTag, seen, list)
				list_identifiers(state, [identifier_type_mapping], curTag, seen, list)
            }

            // go through random names
            for (const candlist of candlists)
            {
                const tag = candlist[0]
                for (var j = 1; j < candlist.length; j++)
                {
                    var m = candlist[j]
                    var extra = ''
                    if (typeof m !== 'string') // only for PRELUDE_COMMAND_WORDS
                    {
                        extra = m[1]
                        m = m[0]
                    }
                    const matchWord = m.toLowerCase()
                    if ( (curWord && matchWord.lastIndexOf(curWord, 0) != 0) || seen.has(matchWord) )
                    	continue
                    seen.add(matchWord)
                    const mytag = (tag === 'COLOR') ? 'COLOR-' + m.toUpperCase() : tag
                    list.push({text: m, extra: extra, tag: mytag, render: renderHint})
                }
            }

			//if list is a single word and that matches what the current word is, don't show hint
			if ( (list.length === 1) && (list[0].text.toLowerCase() === curWord) )
				return { list: [] }

			//if list contains the word that you've typed, put it to top of autocomplete list
			list.splice( 1, 0, ...list.splice(0, list.findIndex( x => (x.text.toLowerCase() === curWord) )) )

            return {
                list: list,
                from: CodeMirror.Pos(cursor.line, start),
                to: CodeMirror.Pos(cursor.line, end)
            }
        })

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
