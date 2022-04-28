
// see https://codemirror.net/doc/manual.html#modeapi
window.CodeMirror.defineMode('puzzle', function()
	{
		'use strict';
		return {
			copyState: function(state) { return state.copy(); },
			blankLine: function(state) { state.blankLine(); },
			token: function(stream, state) { return state.token(stream); },
			startState: function() { return new PuzzleScriptParser(); }
		};
	}
);

moveSelectedLines = function(cm, dir)
{
	var selected_line_ranges = cm.listSelections().map( range => [ Math.min(range.anchor.line, range.head.line), Math.max(range.head.line, range.anchor.line) ] )
	// fuse ranges
	var i=1
	while (i<selected_line_ranges.length)
	{
		if (selected_line_ranges[i][0] <= selected_line_ranges[i-1][1] + 1)
		{
			selected_line_ranges[i-1][1] = selected_line_ranges[i][1]
			selected_line_ranges.splice(i, 1)
		}
		else i++
	}
	// extend document if needed
	if (selected_line_ranges[selected_line_ranges.length-1][1] >= cm.lastLine() )
	{
		// console.log('Adding new line at the end of the document')
		const initial_selections = cm.listSelections() // by default, CodeMirror would extend the selection to include the new line
		cm.replaceRange('\n', CodeMirror.Pos(cm.lastLine()+1), null, '+swapLine')
		cm.setSelections(initial_selections, undefined, '+swapLine')
	}
	if (selected_line_ranges[0][0] + dir < cm.firstLine())
	{
		// console.log('Adding new line at the beginning of the document')
		cm.replaceRange('\n', CodeMirror.Pos(cm.firstLine(), 0), null, '+swapLine')
		selected_line_ranges = selected_line_ranges.map( ([f,t]) => [f+1, t+1])
	}
	// perform all cut/paste operations as a single operation for the editor
	cm.operation(function()
	{
		for (const [start, end] of selected_line_ranges)
		{
			const [from, to] = (dir<0) ? [start-1, end] : [end+1, start]
			// cut the line before/after the range
			const line = cm.getLine(from)
			cm.replaceRange('', CodeMirror.Pos(from, 0), CodeMirror.Pos(from+1, 0), '+swapLine')
			// and past it after/before the range
			cm.replaceRange(line + '\n', CodeMirror.Pos(to, 0), null, '+swapLine')
		}
		cm.scrollIntoView()
	})
}

CodeMirror.commands.moveSelectedLinesUp = function(cm)
{
	moveSelectedLines(cm, -1)
}

CodeMirror.commands.moveSelectedLinesDown = function(cm)
{
	moveSelectedLines(cm, 1)
}

CodeMirror.commands.selectLine = function(cm)
{
	cm.setSelections( cm.listSelections().map( function(range) {
		return {
			anchor: CodeMirror.Pos(range.from().line, 0),
			head: CodeMirror.Pos(range.to().line + 1, 0)
		}
	}))
}

function CodeEditorTabManager(code)
{
	this.name = 'code'
	this.editor = window.CodeMirror.fromTextArea(code, {
	//	viewportMargin: Infinity,
		lineWrapping: true,
		lineNumbers: true,
		styleActiveLine: true,
		extraKeys: {
			'Ctrl-/': 'toggleComment',
			'Cmd-/': 'toggleComment',
			'Esc': CodeMirror.commands.clearSearch,
			'Shift-Ctrl-Up': 'moveSelectedLinesUp',
			// 'Shift-Cmd-Up':  'moveSelectedLinesUp', // conflicts with "select to the beginning/end of the document", and Ctrl works on mac.
			'Shift-Ctrl-Down': 'moveSelectedLinesDown',
			// 'Shift-Cmd-Down':  'moveSelectedLinesDown',
			// 'Ctrl-L': 'selectLine', // shortcut conflicts with URL bar activation in many browsers.
			// 'Cmd-L': 'selectLine',
		}
	})
		
	this.editor.on('mousedown', function(cm, event)
	{
		if (event.target.className == 'cm-SOUND')
		{
			playSound( parseInt(event.target.innerHTML) )
		}
		else if (event.target.className == 'cm-LEVEL')
		{
			if (event.ctrlKey || event.metaKey)
			{
				document.activeElement.blur()  // unfocus code panel
				tabs.removeFocus()
				prevent(event)         // prevent refocus
				const targetLine = cm.posFromMouse(event).line
				compile(
					function(levels)
					{
						for (var i=levels.length-1; i>=0; i--)
						{
							if (levels[i].lineNumber <= targetLine+1)
								return i
						}
						return undefined
					}
				)
			}
		}
	})

	/* https://github.com/ndrake/PuzzleScript/commit/de4ac2a38865b74e66c1d711a25f0691079a290d */
	this.editor.on('change', (cm, changeObj) => tabs.checkDirty() )

	this.editor.on('keyup', function (editor, event) {
		if (!CodeMirror.ExcludedIntelliSenseTriggerKeys[(event.keyCode || event.which).toString()])
		{
			CodeMirror.commands.autocomplete(editor, null, { completeSingle: false });
		}
	})
}

CodeEditorTabManager.prototype =
{

	getContent: function() { return this.editor.getValue() },
	setContent: function(txt) { this.editor.setValue(txt) }, // WIP TODO: does not work when the editor is hidden

	setLoading: function() { this.setContent('loading…') },

	removeFocus: function() { this.editor.display.input.blur() },

	setLightMode: function(mode)
	{
		this.editor.setOption('theme', (['midnight', 'midday'])[mode])
	},

	jumpToLine: function(i)
	{
		// editor.getLineHandle does not help as it does not return the reference of line.
		const ll = this.editor.doc.lastLine()
		const mid = Math.min(i-1, ll)

		this.editor.scrollIntoView(Math.max(i-1-10, 0))
		this.editor.scrollIntoView(Math.min(i-1+10, ll))
		this.editor.scrollIntoView(mid)
		this.editor.setCursor(mid, 0)
	},
}
