
// uses: curlevel, curlevelTarget, state, messagetext

const empty_terminal_line    = '                                  ';
const selected_terminal_line = '##################################';
const doted_terminal_line    = '..................................';

const terminal_width = empty_terminal_line.length
const terminal_height = 13

function isContinuePossible()
{
	return ( (curlevel > 0) || (curlevelTarget !== null) ) && (curlevel in state.levels)
}

MenuScreen.prototype.makeTerminalScreen = function()
{
	this.text = Array.from(
		{
			3: ' Pattern:Script Terminal ',
			4: ' v 1.7 ',
			8: ' insert cartridge ',
			length:terminal_height
		},
		l => (l === undefined) ? doted_terminal_line : centerText(l, doted_terminal_line)
	)
}

MenuScreen.prototype.makeMenuItems = function(menu_entries, nb_lines)
{
	const l = menu_entries.length - 1
	const interline_size = Math.ceil( nb_lines / (l+1) ) - 1
	const menu_height = (interline_size + 1) * l + 1
	const margin_top = Math.floor( ( nb_lines - menu_height ) / 2)
	this.text.push( ...Array(margin_top).fill(empty_terminal_line) )
	for (const [i, item_text] of menu_entries.entries())
	{
		if (this.item === i)
			this.text.push( centerText( '# '+item_text+' #', this.done ? selected_terminal_line : empty_terminal_line) )
		else
			this.text.push( centerText( item_text, empty_terminal_line) )
		if (i < l)
			this.text.push( ...Array(interline_size).fill(empty_terminal_line) )
	}
	this.text.push( ...Array(nb_lines - margin_top - menu_height).fill(empty_terminal_line) )
}

// uses: curlevel, curlevelTarget, state
// sets: this.nb_items, this.text
MenuScreen.prototype.makeTitle = function()
{
	this.nb_items = isContinuePossible() ? 2 : 1

	if (state.levels.length === 0)
	{
		this.makeTerminalScreen()
		return
	}

	const title = (state.metadata.title !== undefined) ? state.metadata.title : 'Pattern:Script Game';

	const title_bottomline = 3
	const author_bottomline = 5
	this.text = [ empty_terminal_line ]

	// Add title
	const max_title_height = (state.metadata.author === undefined) ? author_bottomline : title_bottomline
	var titlelines = wordwrap(title, terminal_width)
	if (titlelines.length > max_title_height)
	{
		titlelines.splice(max_title_height)
		logWarning(['title_truncated', max_title_height], undefined, true)
	}
	this.text.push(...titlelines.map( l => centerText(l) ), ...Array(Math.max(0, max_title_height - titlelines.length - 1)).fill(empty_terminal_line))

	// Add author(s)
	if (state.metadata.author !== undefined)
	{
		var attributionsplit = wordwrap('by ' + state.metadata.author, terminal_width)
		if (attributionsplit[0].length < terminal_width)
		{
			attributionsplit[0] = " " + attributionsplit[0];
		}
		if (attributionsplit.length > author_bottomline - title_bottomline)
		{
			attributionsplit.splice(author_bottomline - title_bottomline)
			logWarning('Author list too long to fit on screen, truncating to three lines.', undefined, true)
		}
		this.text.push(...attributionsplit.map( l => alignTextRight(l, Math.max(l.length - terminal_width, 1)) ))
		// I prefer them centered:
		// this.text.push(...attributionsplit.map( l => centerText(l) ))
	}
	this.text.push( ...Array(author_bottomline - this.text.length).fill(empty_terminal_line) )

	// Add menu options
	this.makeMenuItems( (this.nb_items === 1) ? ['start game'] : ['new game', 'continue'], 3)
	this.text.push( empty_terminal_line )

	// Add key configuration info:
	this.text.push( alignTextLeft('arrow keys to move') )
	this.text.push( alignTextLeft( ('noaction' in state.metadata) ? 'X to select' : 'X to select / action') )
	var msgs = []
	if ( ! ('noundo' in state.metadata) )
		msgs.push('Z to undo')
	if ( ! ('norestart' in state.metadata) )
		msgs.push('R to restart')
	this.text.push( alignTextLeft( msgs.join(', ') ) )

	this.text.push(empty_terminal_line)
}

function centerText(txt, context=empty_terminal_line)
{
	return alignTextLeft(txt, Math.max(0, Math.floor((terminal_width - txt.length)/2)), context)
}

function alignTextLeft(txt, lmargin=7, context=empty_terminal_line)
{
	return context.slice(0, lmargin) + txt + context.slice(txt.length + lmargin)
}

function alignTextRight(txt, rmargin=1, context=empty_terminal_line)
{
	return context.slice(0, -rmargin - txt.length) + txt + context.slice(context.length - rmargin)
}

function wordwrap(str, width)
{
	width = width || 75
 
	if (!str) { return str; }
 
	const regex = '.{1,'+width+'}(\\s|$)|.{'+width+'}|.+$'
	// cont regex = '.{1,'+width+'}(\\s|$)|\\S+?(\\s|$)'
	return str.match( RegExp(regex, 'g') );
}


MenuScreen.prototype.makePauseMenu = function()
{
	this.text = [ empty_terminal_line, centerText('- PAUSE -'), empty_terminal_line ]
	this.makeMenuItems(['resume game', execution_context.hasUsedCheckpoint ? 'restart from checkpoint' : 'restart level', 'exit to title screen' ], terminal_height-4)
	this.text.push( empty_terminal_line )
}


// uses messagetext, state
TextModeScreen.prototype.doMessage = function()
{
	screen_layout.content = this

	this.text = Array(terminal_height).fill(empty_terminal_line)

	const splitMessage = wordwrap((messagetext === '') ? state.levels[curlevel].message.trim() : messagetext, terminal_width)

	const offset = Math.max(0, Math.floor((terminal_height-2)/2) - Math.floor(splitMessage.length/2) )

	const count = Math.min(splitMessage.length, terminal_height - 1)
	for (var i=0; i<count; i++)
	{
		this.text[offset+i] = centerText(splitMessage[i])
	}

	if ( ! this.done )
	{
		this.text[clamp(10, count+1, 12)] = centerText('X to continue')
	}
	
	canvasResize();
}