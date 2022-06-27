PaletteWidget = function(container, item_def)
{
	this.colorpicker_canvas = document.createElement('canvas')
	this.colorpicker_canvas.width = 255
	this.colorpicker_canvas.height = 255
	container.appendChild(this.colorpicker_canvas)
}

PaletteWidget.prototype = {

	redraw: function()
	{

	},

	finalize: function(item_def)
	{
		this.redraw()
	},

	toDef: function(widget)
	{

	},

	sameItems: function(item1, item2)
	{

	},

}


function PalettesTabManager(html_list)
{
	ListTabManager.call(this, html_list, 'palettes', 'Palette', PaletteWidget)
}
PalettesTabManager.prototype = Object.create(ListTabManager.prototype)

PalettesTabManager.prototype.addNewBlankPaletteWidget = function()
{
	this.addNewWidget({ name: '', })
}
