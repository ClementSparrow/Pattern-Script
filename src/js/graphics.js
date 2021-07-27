var canvasdict = {}

function makeSpriteCanvas(name)
{
	var canvas;
	if (name in canvasdict)
	{
		canvas = canvasdict[name];
	} else {
		canvas = document.createElement('canvas');
		canvasdict[name] = canvas;
	}
	canvas.width = cellwidth;
	canvas.height = cellheight;
	return canvas;
}

function createSprite(name, spritegrid, colors, padding)
{
	if (colors === undefined) {
		colors = [state.bgcolor, state.fgcolor];
	}

	var sprite = makeSpriteCanvas(name);
	var spritectx = sprite.getContext('2d');

    spritectx.clearRect(0, 0, cellwidth, cellheight);

	const w = spritegrid[0].length;
	const h = spritegrid.length;
	const cw = ~~(cellwidth / (w + (padding|0)));
    const ch = ~~(cellheight / (h + (padding|0)));
    var pixh = ch;
    if ("scanline" in state.metadata) {
        pixh = Math.ceil(ch/2);
    }
    spritectx.fillStyle = state.fgcolor;
    for (var j = 0; j < h; j++) {
        for (var k = 0; k < w; k++) {
            var val = spritegrid[j][k];
            if (val >= 0) {
                const cy = (j * ch)|0;
                const cx = (k * cw)|0;
                spritectx.fillStyle = colors[val];
                spritectx.fillRect(cx, cy, cw, pixh);
            }
        }
    }

    return sprite;
}

function regenText(spritecanvas, spritectx)
{
	textImages = {}

	for (var n in font)
    {
		if (font.hasOwnProperty(n))
        {
			textImages[n] = createSprite('char'+n, font[n], undefined, 1);
		}
	}
}

const editor_s_grille = [
    [0,1,1,1,0],
    [1,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,1],
    [0,1,1,1,0]
];

var spriteimages;

// called only by redraw() (if spriteimages is undefined) and canvasResize() (if forceRegenImages is true or one of the layout parameters has changed)
function regenSpriteImages()
{
	if (textMode) {
		regenText();
		return;
	}
	// else if (levelEditorOpened)
	// if (textImages['editor_s'] === undefined)
	{
        textImages['editor_s'] = createSprite('chars', editor_s_grille, undefined);
    }
    
    if (state.levels.length === 0)
        return;

    spriteimages = [];

	for (var i = 0; i < sprites.length; i++)
	{
        if (sprites[i] !== undefined)
		{
			spriteimages[i] = createSprite(i.toString(), sprites[i].dat, sprites[i].colors);
		}
	}

    if (canOpenEditor) {
    	generateGlyphImages();
    }
}

var glyphImagesCorrespondance;
var glyphImages;
var glyphHighlight;
var glyphHighlightResize;
var glyphPrintButton;
var glyphMouseOver;
var glyphSelectedIndex=0;
var editorRowCount=1;



function generateGlyphImages()
{
    if (cellwidth === 0 || cellheight === 0)
        return;

	glyphImagesCorrespondance = [];
	glyphImages = [];
	
	for (const [identifier_index, g] of state.glyphDict.entries())
    {
        const n = state.identifiers.names[identifier_index];
        
        if ( (n.length > 1) || (! [identifier_type_object, identifier_type_property, identifier_type_aggregate].includes(state.identifiers.comptype[identifier_index])) )
            continue;

        var sprite = makeSpriteCanvas("C"+n)
        var spritectx = sprite.getContext('2d');
        glyphImagesCorrespondance.push(identifier_index);
        for (const id of g)
        {
            if (id === -1)
                continue;
            spritectx.drawImage(spriteimages[id], 0, 0);
        }
        glyphImages.push(sprite);
	}

	{
		//make highlight thingy
		glyphHighlight = makeSpriteCanvas("highlight");
		var spritectx = glyphHighlight.getContext('2d');
		spritectx.fillStyle = '#FFFFFF';

		spritectx.fillRect(0,0,cellwidth,1);
		spritectx.fillRect(0,0,1,cellheight);
		
		spritectx.fillRect(0,cellheight-1,cellwidth,1);
		spritectx.fillRect(cellwidth-1,0,1,cellheight);
	}

	{
		glyphPrintButton = textImages['editor_s'];
	}
	{
		//make highlight thingy
		glyphHighlightResize = makeSpriteCanvas("highlightresize");
		var spritectx = glyphHighlightResize.getContext('2d');
		spritectx.fillStyle = '#FFFFFF';
		
		var minx=((cellwidth/2)-1)|0;
		var xsize=cellwidth-minx-1-minx;
		var miny=((cellheight/2)-1)|0;
		var ysize=cellheight-miny-1-minx;

		spritectx.fillRect(minx,0,xsize,cellheight);
		spritectx.fillRect(0,miny,cellwidth,ysize);
	}

	{
		//make highlight thingy
		glyphMouseOver = makeSpriteCanvas();
		var spritectx = glyphMouseOver.getContext('2d');
		spritectx.fillStyle = 'yellow';
		
		spritectx.fillRect(0,0,cellwidth,2);
		spritectx.fillRect(0,0,2,cellheight);
		
		spritectx.fillRect(0,cellheight-2,cellwidth,2);
		spritectx.fillRect(cellwidth-2,0,2,cellheight);
	}
}

var canvas;
var ctx;


var x;
var y;
var cellwidth;
var cellheight;
var xoffset;
var yoffset;

window.addEventListener('resize', canvasResize, false);
canvas = document.getElementById('gameCanvas');
ctx = canvas.getContext('2d');
x = 0;
y = 0;

function glyphCount()
{
    return state.glyphDict.filter( (glyph, identifier_index) => (state.identifiers.names[identifier_index].length == 1) ).length;
}

// TODO: this should be in a file for the console, so that we can ship the game without it.
var highlighted_cell = null;
function highlightCell(coords)
{
    highlighted_cell = coords;
    redraw()
}

function redraw()
{
    if (cellwidth === 0 || cellheight === 0)
        return;

    if (spriteimages === undefined)
    {
        regenSpriteImages();
    }

    if (textMode)
    {
        ctx.fillStyle = state.bgcolor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (var i = 0; i < titleWidth; i++) {
            for (var j = 0; j < titleHeight; j++) {
                const ch = titleImage[j].charAt(i);
                if (ch in textImages) {
                    const sprite = textImages[ch];
                    ctx.drawImage(sprite, xoffset + i * cellwidth, yoffset + j * cellheight);
                }
            }
        }
        return;
    }

    ctx.fillStyle = state.bgcolor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var mini = 0;
    var maxi = screenwidth;
    var minj = 0;
    var maxj = screenheight;

    if (levelEditorOpened)
    {
        const glyphcount = glyphCount();
        editorRowCount = Math.ceil(glyphcount/(screenwidth-1));
        maxi -= 2;
        maxj -= 2 + editorRowCount;
    }
    else if (flickscreen)
    {
        var playerPositions = getPlayerPositions();
        if (playerPositions.length>0) {
            var playerPosition=playerPositions[0];
            var px = (playerPosition/(level.height))|0;
            var py = (playerPosition%level.height)|0;

            var screenx = (px/screenwidth)|0;
            var screeny = (py/screenheight)|0;
            mini=screenx*screenwidth;
            minj=screeny*screenheight;
            maxi=Math.min(mini+screenwidth,level.width);
            maxj=Math.min(minj+screenheight,level.height);

            oldflickscreendat=[mini,minj,maxi,maxj];
        } else if (oldflickscreendat.length>0){
            mini=oldflickscreendat[0];
            minj=oldflickscreendat[1];
            maxi=oldflickscreendat[2];
            maxj=oldflickscreendat[3];
        }
    } else if (zoomscreen) {
        var playerPositions = getPlayerPositions();
        if (playerPositions.length>0) {
            var playerPosition=playerPositions[0];
            var px = (playerPosition/(level.height))|0;
            var py = (playerPosition%level.height)|0;
            mini=Math.max(Math.min(px-((screenwidth/2)|0),level.width-screenwidth),0);
            minj=Math.max(Math.min(py-((screenheight/2)|0),level.height-screenheight),0);
            maxi=Math.min(mini+screenwidth,level.width);
            maxj=Math.min(minj+screenheight,level.height);
            oldflickscreendat=[mini,minj,maxi,maxj];
        }  else if (oldflickscreendat.length>0){
            mini=oldflickscreendat[0];
            minj=oldflickscreendat[1];
            maxi=oldflickscreendat[2];
            maxj=oldflickscreendat[3];
        }         
    }
    

    for (var i = mini; i < maxi; i++)
    {
        for (var j = minj; j < maxj; j++)
        {
            const posMask = level.getCellInto(j + i*level.height, _o12);
            for (var k = 0; k < state.objectCount; k++)
            {
                if (posMask.get(k) != 0)
                {
                    const sprite = spriteimages[k];
                    ctx.drawImage(sprite, xoffset + (i-mini) * cellwidth, yoffset + (j-minj) * cellheight);
                }
            }
        }
    }

    if (levelEditorOpened)
    {
    	drawEditorIcons(mini, minj);
    }
    // highlight the cell hovered in the output of verbose_logging.
    // TODO: this should not be in this function and should be in a file for the console, so that we can ship the game without it.
    if (highlighted_cell !== null)
    {
        ctx.drawImage(glyphHighlight, xoffset+(highlighted_cell[0]-mini)*cellwidth, yoffset+(highlighted_cell[1]-minj)*cellheight);
    }
}

// TODO: this should not be in graphics.js but in a file dedicated to the editor mode, so that we can ship games without embeding the editor
function drawEditorIcons(mini, minj)
{
	var glyphCount = glyphImages.length;
	var glyphStartIndex=0;
	var glyphEndIndex = glyphImages.length;/*Math.min(
							glyphStartIndex+10,
							screenwidth-2,
							glyphStartIndex+Math.max(glyphCount-glyphStartIndex,0)
							);*/
	var glyphsToDisplay = glyphEndIndex-glyphStartIndex;

	ctx.drawImage(glyphPrintButton, xoffset-cellwidth,yoffset-cellheight*(1+editorRowCount));
	if (mouseCoordY===(-1-editorRowCount)&&mouseCoordX===-1) {
			ctx.drawImage(glyphMouseOver,xoffset-cellwidth,yoffset-cellheight*(1+editorRowCount));								
	}

	var ypos = editorRowCount-(-mouseCoordY-2)-1;
	var mouseIndex=mouseCoordX+(screenwidth-1)*ypos;

	for (var i=0; i<glyphsToDisplay; i++)
    {
		const glyphIndex = glyphStartIndex+i;
		const sprite = glyphImages[glyphIndex];
        const xpos=i%(screenwidth-1);
        const ypos=(i/(screenwidth-1))|0;
		ctx.drawImage(sprite,xoffset+(xpos)*cellwidth,yoffset+ypos*cellheight-cellheight*(1+editorRowCount));
		if ( (mouseCoordX >= 0) && (mouseCoordX < (screenwidth-1)) && (mouseIndex === i) )
        {
			ctx.drawImage(glyphMouseOver,xoffset+xpos*cellwidth,yoffset+ypos*cellheight-cellheight*(1+editorRowCount));						
		}
		if (i === glyphSelectedIndex)
        {
			ctx.drawImage(glyphHighlight,xoffset+xpos*cellwidth,yoffset+ypos*cellheight-cellheight*(1+editorRowCount));
		} 		
	}

    var tooltip_string = ''
    var tooltip_objects = null
    // prepare tooltip: legend for highlighted editor icon
    if ( (mouseCoordX >= 0) && (mouseCoordX < screenwidth) && (mouseIndex >= 0) && (mouseIndex < glyphsToDisplay) )
    {
        const glyphIndex = glyphStartIndex + mouseIndex
        const identifier_index = glyphImagesCorrespondance[glyphIndex]
        tooltip_string = state.identifiers.names[identifier_index] + ' = '
        tooltip_objects = state.identifiers.getObjectsForIdentifier(identifier_index)
    }
    // prepare tooltip: content of a level's cell
    else if ( (mouseCoordX >= 0) && (mouseCoordY >= 0) && (mouseCoordX < screenwidth) && (mouseCoordY < screenheight-editorRowCount) )
    {
        const posMask = level.getCellInto((mouseCoordY+minj) + (mouseCoordX+mini)*level.height, _o12);
        tooltip_objects = state.idDict.filter( (x,k) => (posMask.get(k) != 0) )
    }
    // prepare tooltip: object names
    if (tooltip_objects !== null)
    {
        tooltip_string = tooltip_string + Array.from(tooltip_objects, oi => state.identifiers.objects[oi].name).join(' ')
    }
    // show tooltip
    if (tooltip_string.length > 0)
    {
        ctx.fillStyle = state.fgcolor
        ctx.fillText(tooltip_string, xoffset, yoffset-0.4*cellheight)
    }

	if (mouseCoordX>=-1&&mouseCoordY>=-1&&mouseCoordX<screenwidth-1&&mouseCoordY<screenheight-1-editorRowCount)
    {
		if (mouseCoordX==-1||mouseCoordY==-1||mouseCoordX==screenwidth-2||mouseCoordY===screenheight-2-editorRowCount)
        {
            // show "+" cursor to resize the level
			ctx.drawImage(glyphHighlightResize,
				xoffset+mouseCoordX*cellwidth,
				yoffset+mouseCoordY*cellheight
				);
		} else {
            // highlight cell in level
			ctx.drawImage(glyphHighlight,
				xoffset+mouseCoordX*cellwidth,
				yoffset+mouseCoordY*cellheight
				);
		}
	}
}

var lastDownTarget;

var oldcellwidth=0;
var oldcellheight=0;
var oldtextmode=-1;
var oldfgcolor=-1;
var forceRegenImages=false;

function canvasResize()
{
    canvas.width = canvas.parentNode.clientWidth;
    canvas.height = canvas.parentNode.clientHeight;

    screenwidth = level.width;
    screenheight = level.height;
    if (state!==undefined)
    {
        flickscreen=state.metadata.flickscreen!==undefined;
        zoomscreen=state.metadata.zoomscreen!==undefined;
	    if (levelEditorOpened) {
            screenwidth+=2;
            var glyphcount = glyphCount();
            editorRowCount = Math.ceil(glyphcount/(screenwidth-1));
            screenheight+=2+editorRowCount;
        } else if (flickscreen) {
	        screenwidth=state.metadata.flickscreen[0];
	        screenheight=state.metadata.flickscreen[1];
	    } else if (zoomscreen) {
	        screenwidth=state.metadata.zoomscreen[0];
	        screenheight=state.metadata.zoomscreen[1];
	    }
	}

    if (textMode) {
        screenwidth=titleWidth;
        screenheight=titleHeight;
    }
    
    cellwidth = canvas.width / screenwidth;
    cellheight = canvas.height / screenheight;

    var w = sprite_width //5;//sprites[1].dat.length;
    var h = sprite_height //5;//sprites[1].dat[0].length;


    if (textMode) {
        w=font['X'][0].length + 1;
        h=font['X'].length + 1;
    }


    cellwidth  = w * Math.max( ~~(cellwidth / w),1);
    cellheight = h * Math.max(~~(cellheight / h),1);

    xoffset = 0;
    yoffset = 0;

    if (cellwidth / w > cellheight / h) {
        cellwidth = cellheight * w / h;
        xoffset = (canvas.width - cellwidth * screenwidth) / 2;
        yoffset = (canvas.height - cellheight * screenheight) / 2;
    }
    else { //if (cellheight > cellwidth) {
        cellheight = cellwidth * h / w;
        yoffset = (canvas.height - cellheight * screenheight) / 2;
        xoffset = (canvas.width - cellwidth * screenwidth) / 2;
    }

    if (levelEditorOpened && !textMode) {
    	xoffset+=cellwidth;
    	yoffset+=cellheight*(1+editorRowCount);
    }

    cellwidth = cellwidth|0;
    cellheight = cellheight|0;
    xoffset = xoffset|0;
    yoffset = yoffset|0;

    if (oldcellwidth!=cellwidth || oldcellheight!=cellheight || oldtextmode!=textMode || oldfgcolor!=state.fgcolor || forceRegenImages)
    {
    	forceRegenImages = false;
    	regenSpriteImages();
    }

    oldcellheight=cellheight;
    oldcellwidth=cellwidth;
    oldtextmode=textMode;
    oldfgcolor=state.fgcolor;

    redraw();
}
