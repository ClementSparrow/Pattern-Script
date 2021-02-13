
// uses: curlevel, curlevelTarget, state, messagetext, quittingMessageScreen

var intro_template = [
	"..................................",
	"..................................",
	"..................................",
	"......Puzzle Script Terminal......",
	"..............v 1.7...............",
	"..................................",
	"..................................",
	"..................................",
	".........insert cartridge.........",
	"..................................",
	"..................................",
	"..................................",
	".................................."
];

var messagecontainer_template = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..........X to continue...........",
	"..................................",
	".................................."
];

var titletemplate_firstgo = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..........#.start game.#..........",
	"..................................",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	".................................."];

var titletemplate_select0 = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"...........#.new game.#...........",
	"..................................",
	".............continue.............",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	".................................."];

var titletemplate_select1 = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	".............new game.............",
	"..................................",
	"...........#.continue.#...........",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	".................................."];


var titletemplate_firstgo_selected = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"###########.start game.###########",
	"..................................",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	".................................."];

var titletemplate_select0_selected = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"############.new game.############",
	"..................................",
	".............continue.............",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	".................................."];

var titletemplate_select1_selected = [
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	"..................................",
	".............new game.............",
	"..................................",
	"############.continue.############",
	"..................................",
	".arrow keys to move...............",
	".X to action......................",
	".Z to undo, R to restart..........",
	"................................."];

var titleImage=[];
var titleWidth=titletemplate_select1[0].length;
var titleHeight=titletemplate_select1.length;
var textMode=true;
var titleScreen=true;
var titleMode=0;//1 means there are options
var titleSelection=0;
var titleSelected=false;

// uses: curlevel, curlevelTarget, state
function generateTitleScreen()
{
	titleMode=(curlevel>0||curlevelTarget!==null)?1:0;

	if (state.levels.length===0) {
		titleImage=intro_template;
		return;
	}

	var title = "PuzzleScript Game";
	if (state.metadata.title!==undefined) {
		title=state.metadata.title;
	}

	if (titleMode===0) {
		if (titleSelected) {
			titleImage = deepClone(titletemplate_firstgo_selected);		
		} else {
			titleImage = deepClone(titletemplate_firstgo);					
		}
	} else {
		if (titleSelection===0) {
			if (titleSelected) {
				titleImage = deepClone(titletemplate_select0_selected);		
			} else {
				titleImage = deepClone(titletemplate_select0);					
			}			
		} else {
			if (titleSelected) {
				titleImage = deepClone(titletemplate_select1_selected);		
			} else {
				titleImage = deepClone(titletemplate_select1);					
			}						
		}
	}

	var noAction = 'noaction' in state.metadata;	
	var noUndo = 'noundo' in state.metadata;
	var noRestart = 'norestart' in state.metadata;
	if (noUndo && noRestart) {
		titleImage[11]="..............................................";
	} else if (noUndo) {
		titleImage[11]=".......R to restart...........................";
	} else if (noRestart) {
		titleImage[11]=".Z to undo.....................";
	}
	if (noAction) {
		titleImage[10]=".......X to select............................";
	}
	for (var i=0;i<titleImage.length;i++)
	{
		titleImage[i]=titleImage[i].replace(/\./g, ' ');
	}

	var width = titleImage[0].length;
	var titlelines=wordwrap(title,titleImage[0].length);
	if (state.metadata.author !== undefined)
	{
		if (titlelines.length > 3)
		{
			titlelines.splice(3);
			logWarning("Game title is too long to fit on screen, truncating to three lines.",undefined,true);
		}
	} else {
		if (titlelines.length > 5)
		{
			titlelines.splice(5);
			logWarning("Game title is too long to fit on screen, truncating to five lines.",undefined,true);
		}
	}
	for (var i=0;i<titlelines.length;i++) {
		var titleline=titlelines[i];
		var titleLength=titleline.length;
		var lmargin = ((width-titleLength)/2)|0;
		var rmargin = width-titleLength-lmargin;
		var row = titleImage[1+i];
		titleImage[1+i]=row.slice(0,lmargin)+titleline+row.slice(lmargin+titleline.length);
	}
	if (state.metadata.author!==undefined) {
		var attribution="by "+state.metadata.author;
		var attributionsplit = wordwrap(attribution,titleImage[0].length);
		if (attributionsplit[0].length < titleImage[0].length)
		{
			attributionsplit[0] = " " + attributionsplit[0];
		}
		if (attributionsplit.length>3)
		{
			attributionsplit.splice(3);
			logWarning("Author list too long to fit on screen, truncating to three lines.", undefined, true);
		}
		for (var i=0;i<attributionsplit.length;i++) {
			var line = attributionsplit[i]+" ";
			if (line.length>width){
				line=line.slice(0,width);
			}
			var row = titleImage[3+i];
			titleImage[3+i]=row.slice(0,width-line.length)+line;
		}
	}

}



function wordwrap( str, width ) {
 
	width = width || 75;
	var cut = true;
 
	if (!str) { return str; }
 
	var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');
 
	return str.match( RegExp(regex, 'g') );
 
}

var splitMessage=[];

// uses messagetext, state, quittingMessageScreen
function drawMessageScreen() {
	titleMode=0;
	textMode=true;
	titleImage = deepClone(messagecontainer_template);

	for (var i=0;i<titleImage.length;i++)
	{
		titleImage[i]=titleImage[i].replace(/\./g, ' ');
	}

	var emptyLineStr = titleImage[9];
	var xToContinueStr = titleImage[10];

	titleImage[10]=emptyLineStr;

	var width = titleImage[0].length;

	var message;
	if (messagetext==="") {
		var leveldat = state.levels[curlevel];
		message = leveldat.message.trim();
	} else {
		message = messagetext;
	}
	
	splitMessage = wordwrap(message,titleImage[0].length);


	var offset = 5-((splitMessage.length/2)|0);
	if (offset<0){
		offset=0;
	}

	var count = Math.min(splitMessage.length,12);
	for (var i=0;i<count;i++) {
		var m = splitMessage[i];
		var row = offset+i;	
		var messageLength=m.length;
		var lmargin = ((width-messageLength)/2)|0;
		var rmargin = width-messageLength-lmargin;
		var rowtext = titleImage[row];
		titleImage[row]=rowtext.slice(0,lmargin)+m+rowtext.slice(lmargin+m.length);		
	}

	var endPos = 10;
	if (count>=10) {
		if (count<12){
			endPos = count + 1;
		} else {
			endPos = 12;
		}
		}
	if (quittingMessageScreen) {
		titleImage[endPos]=emptyLineStr;
	} else {
		titleImage[endPos]=xToContinueStr;
	}
	
	canvasResize();
}