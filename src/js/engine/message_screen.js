
// uses: state, messagetext

const empty_terminal_line    = '                                  ';
const selected_terminal_line = '##################################';
const doted_terminal_line    = '..................................';

const terminal_width = empty_terminal_line.length
const terminal_height = 13

MenuScreen.prototype.isContinuePossible = function()
{
	return ( (this.curlevel > 0) || (this.curlevelTarget !== undefined) ) && (this.curlevel in state.levels)
}


function skipTextLevels()
{
	while ( (state.levels[curlevel].message !== undefined) && (curlevel < state.levels.length - 1) )
		curlevel++
	loadLevelFromState(state, curlevel)
}

function titleMenuNewGame()
{
	loadLevelFromState(state, 0)
}

MenuScreen.prototype.titleMenuContinue = function()
{
	loadLevelFromState(state, this.curlevel, undefined, true, this.curlevelTarget)
}


function pauseMenuRestart()
{
	loadLevelFromState(state, curlevel)
}

MenuScreen.prototype.doSelectedFunction = function()
{
	this.done = false
	const func = this.menu_entries[this.item][1]
	this.updateMenuItems() // in case we need to come back to the menu after the selected function
	func()
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
		l => [(l === undefined) ? doted_terminal_line : centerText(l, doted_terminal_line), '#ffffff']
	)
}

MenuScreen.prototype.makeMenuItems = function(nb_lines, menu_entries)
{
	this.done = false
	this.menu_entries = menu_entries
	const l = menu_entries.length - 1
	this.interline_size = Math.ceil( nb_lines / (l+1) )
	const menu_height = this.interline_size*l + 1
	this.first_menu_line = this.text.length + Math.floor( ( nb_lines - menu_height ) / 2)
	this.text.push( ...Array(nb_lines).fill(['', state.fgcolor]) )
	this.item = 0
	this.updateMenuItems()
}

MenuScreen.prototype.updateMenuItems = function()
{
	for (const [i, [item_text, item_function]] of this.menu_entries.entries())
	{
		this.text[this.first_menu_line + i*this.interline_size] = [centerText( item_text, empty_terminal_line), state.fgcolor]
	}
	this.text[this.first_menu_line + this.item*this.interline_size] = [centerText( '# '+this.menu_entries[this.item][0]+' #', this.done ? selected_terminal_line : empty_terminal_line), state.fgcolor]
}

MenuScreen.prototype.openMenu = function(previous_screen = screen_layout.content)
{
	this.escaped_screen = previous_screen
	screen_layout.content = this
	tryPlaySimpleSound(this.open_soundname)
	canvasResize()
}

MenuScreen.prototype.closeMenu = function()
{
	if (this.escaped_screen === null)
		return
	screen_layout.content = this.escaped_screen
	// TODO: closing the title screen back to the pause menu does not play pausescreen sound.
	canvasResize()
}

function getCurrentLevel(lvl = curlevel)
{
	// If this is called during a message, we return the next level.
	for (let i = lvl; i < state.levels.length; ++i)
	{
		if (state.levels[i].type === 'level')
		{
			return state.levels[i]
		}
	}

	// If this is called for a message after the final level, we instead return the final level.
	for (let i = lvl-1; i >= 0; --i)
	{
		if (state.levels[i].type === 'level')
		{
			return state.levels[i]
		}
	}
	
	// Panic
	return null
	// (this should only happen if the game has no levels)
}

// sets: this.text
MenuScreen.prototype.makeTitle = function()
{
	if (state.levels.length === 0)
	{
		this.makeTerminalScreen()
		return
	}

	const title = (state.metadata.title !== undefined) ? state.metadata.title : 'Pattern:Script Game';

	const title_bottomline = 3
	const author_bottomline = 5
	const empty_line = ['', state.fgcolor]
	this.text = [ empty_line ]

	// Add title
	const max_title_height = (state.metadata.author === undefined) ? author_bottomline : title_bottomline
	var titlelines = wordwrap(title)
	if (titlelines.length > max_title_height)
	{
		titlelines.splice(max_title_height)
		logWarning(['title_truncated', max_title_height], undefined, true)
	}
	this.text.push(...titlelines.map( l => [centerText(l), state.titlecolor] ), ...Array(Math.max(0, max_title_height - titlelines.length - 1)).fill(empty_line))

	// Add author(s)
	if (state.metadata.author !== undefined)
	{
		var attributionsplit = wordwrap('by ' + state.metadata.author)
		if (attributionsplit[0].length < terminal_width)
		{
			attributionsplit[0] = " " + attributionsplit[0];
		}
		if (attributionsplit.length > author_bottomline - title_bottomline)
		{
			attributionsplit.splice(author_bottomline - title_bottomline)
			logWarning('Author list too long to fit on screen, truncating to three lines.', undefined, true)
		}
		this.text.push(...attributionsplit.map( l => [alignTextRight(l, Math.max(l.length - terminal_width, 1)), state.authorcolor] ))
		// I prefer them centered:
		// this.text.push(...attributionsplit.map( l => centerText(l) ))
	}
	this.text.push( ...Array(author_bottomline - this.text.length).fill(empty_line) )

	// Add menu options
	this.makeMenuItems(3,  this.isContinuePossible() ? [['continue from '+getCurrentLevel(this.curlevel).name, () => this.titleMenuContinue()], ['new game', titleMenuNewGame]] : [['start', titleMenuNewGame]])
	this.text.push( empty_line )

	// Add key configuration info:
	this.text.push( [alignTextLeft('arrow keys to move'), state.keyhintcolor] )
	this.text.push( [alignTextLeft( ('noaction' in state.metadata) ? 'X to select' : 'X to select / action'), state.keyhintcolor] )
	var msgs = []
	if ( ! ('noundo' in state.metadata) )
		msgs.push('Z to undo')
	if ( ! ('norestart' in state.metadata) )
		msgs.push('R to restart')
	this.text.push( [alignTextLeft( msgs.join(', ') ), state.keyhintcolor] )

	this.text.push(empty_line)
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

function wordwrap(str, width = terminal_width)
{
	if (!str) { return str; }
 
	const regex = '.{1,'+width+'}(\\s|$)|.{'+width+'}|.+$'
	// cont regex = '.{1,'+width+'}(\\s|$)|\\S+?(\\s|$)'
	return str.match( RegExp(regex, 'g') );
}



MenuScreen.prototype.makePauseMenu = function()
{
	const empty_line = [empty_terminal_line, state.fgcolor]
	const level = getCurrentLevel()
	this.text = [ empty_line, [centerText('-< GAME PAUSED >-'), state.titlecolor], [centerText(level.name), state.titlecolor] ]
	if ( ! ('hide_level_title_in_menu' in state.metadata) )
	{
		let title = level.title
		if (title.length > empty_terminal_line.length)
			title = title.substring(0, empty_terminal_line.length - 3) + '...'
		this.text.push([centerText(title), state.titlecolor])
	}
	this.text.push( empty_line )
	var menu_entries = [
		['resume game', () => this.closeMenu()],
		(screen_layout.content.screen_type === 'text') ? ['skip text', skipTextLevels] : ['replay level from the start', pauseMenuRestart],
		['exit to title screen', goToTitleScreen]
	]
	this.makeMenuItems(terminal_height - 5, menu_entries)
	this.text.push( empty_line )
}


// uses messagetext, state, curlevel
TextModeScreen.prototype.doMessage = function()
{
	screen_layout.content = this
	const empty_line = [ empty_terminal_line, state.fgcolor ]

	this.text = Array(terminal_height).fill(empty_line)

	const splitMessage = wordwrap((messagetext === '') ? state.levels[curlevel].message.trim() : messagetext)

	const offset = Math.max(0, Math.floor((terminal_height-2)/2) - Math.floor(splitMessage.length/2) )

	const count = Math.min(splitMessage.length, terminal_height - 1)
	for (var i=0; i<count; i++)
	{
		this.text[offset+i] = [centerText(splitMessage[i]), state.fgcolor]
	}

	if ( ! this.done )
	{
		this.text[clamp(10, count+1, 12)] = [centerText('X to continue'), state.keyhintcolor]
	}
	
	canvasResize()
}