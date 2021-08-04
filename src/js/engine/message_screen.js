
// uses: curlevel, curlevelTarget, state, messagetext, quittingMessageScreen

const empty_terminal_line    = '                                  ';
const selected_terminal_line = '##################################';
const doted_terminal_line    = '..................................';
const terminal_width = empty_terminal_line.length
const terminal_height = 13

const intro_template = [
	doted_terminal_line,
	doted_terminal_line,
	doted_terminal_line,
	centerText(' Pattern:Script Terminal ', doted_terminal_line),
	centerText(' v 1.7 ', doted_terminal_line),
	doted_terminal_line,
	doted_terminal_line,
	doted_terminal_line,
	centerText(' insert cartridge ', doted_terminal_line),
	doted_terminal_line,
	doted_terminal_line,
	doted_terminal_line,
	doted_terminal_line
];


var titleImage = []
var titleScreen = true
var titleMode = 0 //1 means there are options
var titleSelection = 0 //which item is currently highlighted/selected
var titleSelected = false //only highlighted. Will be set to true when action key is pressed.

// uses: curlevel, curlevelTarget, state
function generateTitleScreen()
{
	titleMode = ( (curlevel>0) || (curlevelTarget !== null) ) ? 1 : 0

	if (state.levels.length === 0)
	{
		titleImage = intro_template
		return;
	}

	const title = (state.metadata.title !== undefined) ? state.metadata.title : "Pattern:Script Game";

	const title_bottomline = 3
	const author_bottomline = 5
	titleImage = [ empty_terminal_line ]

	// Add title
	const max_title_height = (state.metadata.author === undefined) ? author_bottomline : title_bottomline
	var titlelines = wordwrap(title, terminal_width)
	if (titlelines.length > max_title_height)
	{
		titlelines.splice(max_title_height)
		logWarning('Game title is too long to fit on screen, truncating to '+max_title_height+' lines.', undefined, true)
	}
	titleImage.push(...titlelines.map( l => centerText(l) ), ...Array(max_title_height - titlelines.length - 1).fill(empty_terminal_line))

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
			logWarning("Author list too long to fit on screen, truncating to three lines.", undefined, true)
		}
		titleImage.push(...attributionsplit.map( l => alignTextRight(l, Math.max(l.length - terminal_width, 1)) ))
		// I prefer them centered:
		// titleImage.push(...attributionsplit.map( l => centerText(l) ))
	}
	titleImage.push( ...Array(author_bottomline - titleImage.length).fill(empty_terminal_line) )

	// Add menu options
	if (titleMode == 0)
	{
		titleImage.push( empty_terminal_line, centerText('# start game #', titleSelected ? selected_terminal_line : empty_terminal_line), empty_terminal_line)
	}
	else
	{
		titleImage.push(
			centerText( (titleSelection == 0) ? '# new game #' : 'new game' , (titleSelected && (titleSelection == 0)) ? selected_terminal_line : empty_terminal_line),
			empty_terminal_line,
			centerText( (titleSelection == 1) ? '# continue #' : 'continue', (titleSelected && (titleSelection == 1)) ? selected_terminal_line : empty_terminal_line)
		)
	}
	titleImage.push(empty_terminal_line)

	// Add key configuration info:
	titleImage.push( alignTextLeft('arrow keys to move') )
	titleImage.push( alignTextLeft( ('noaction' in state.metadata) ? 'X to select' : 'X to action') )
	var msgs = []
	if ( ! ('noundo' in state.metadata) )
		msgs.push('Z to undo')
	if ( ! ('norestart' in state.metadata) )
		msgs.push('R to restart')
	titleImage.push( alignTextLeft( msgs.join(', ') ) )

	titleImage.push(empty_terminal_line)
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


// uses messagetext, state, quittingMessageScreen
function drawMessageScreen()
{
	titleMode = 0
	screen_layout.content = textmode_screen

	titleImage = Array(terminal_height).fill(empty_terminal_line)

	const splitMessage = wordwrap((messagetext === '') ? state.levels[curlevel].message.trim() : messagetext, terminal_width)

	const offset = Math.max(0, Math.floor((terminal_height-2)/2) - Math.floor(splitMessage.length/2) )

	const count = Math.min(splitMessage.length, terminal_height - 1)
	for (var i=0; i<count; i++)
	{
		titleImage[offset+i] = centerText(splitMessage[i])
	}

	if ( ! quittingMessageScreen)
	{
		titleImage[ Math.max(10, Math.min(count+1, 12)) ] = centerText("X to continue")
	}
	
	canvasResize();
}