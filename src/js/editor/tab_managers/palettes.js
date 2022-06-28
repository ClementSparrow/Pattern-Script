PaletteWidget = function(container, item_def)
{
	this.z = 0

	this.colorpicker_canvas = document.createElement('canvas')
	this.colorpicker_canvas.width = 255
	this.colorpicker_canvas.height = 255
	container.appendChild(this.colorpicker_canvas)

	this.zbar_canvas = document.createElement('canvas')
	this.zbar_canvas.width = 16
	this.zbar_canvas.height = 255
	container.appendChild(this.zbar_canvas)
	this.zbar_canvas.addEventListener('mousedown', e => this.start_zdrag(e), false)

	this.colors = []
}


PaletteWidget.prototype = {

	drawField: function(canvas, r_vec, g_vec, b_vec)
	{
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = 'black'
		const [w, h] = [canvas.width, canvas.height]
		ctx.fillRect(0, 0, w, h)
		const image_data = ctx.getImageData(0, 0, w, h)
		const pixels = image_data.data
		for (let y=0, i=0; y<h; ++y)
		{
			for (let x=0; x<w; ++x, i+=4)
			{
				pixels[i  ] = r_vec[0]*x + r_vec[1]*y + r_vec[2]*this.z + r_vec[3]
				pixels[i+1] = g_vec[0]*x + g_vec[1]*y + g_vec[2]*this.z + g_vec[3]
				pixels[i+2] = b_vec[0]*x + b_vec[1]*y + b_vec[2]*this.z + b_vec[3]
				pixels[i+3] = 255
			}
		}
		ctx.putImageData(image_data, 0, 0)
	},

	drawMark: function(canvas, pos)
	{
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = 'white'
		ctx.fillRect(pos[0]-5, pos[1]-5, 10, 10)
	},

	redraw: function()
	{
		this.drawField(this.colorpicker_canvas, [1, 0, 0, 0], [0, -1, 0, 255], [0, 0, 1, 0])
		this.drawField(this.zbar_canvas, [0, 0, 0, 0], [0, 0, 0, 0], [0, -1, 0, 255])
		this.drawMark(this.zbar_canvas, [this.zbar_canvas.width/2, 255-this.z])
	},

	start_zdrag: function(event)
	{
		const dy = event.pageY - window.scrollY - this.zbar_canvas.getBoundingClientRect().top - 255 + this.z
		if (Math.abs(dy) > 5)
			return false
		this.drag_zbar = this.z
		
		const zdrag = (e) =>
		{
			this.z = clamp(0, this.drag_zbar + event.pageY - e.pageY, 255)
			this.redraw()
			return true
		}
		const end_zdrag = (e) => {
			document.removeEventListener('mousemove', zdrag)
			zdrag(e)
			this.drag_zbar = null
			this.redraw()
			return true
		}
		document.addEventListener('mousemove', zdrag, false)
		document.addEventListener('mouseup', end_zdrag, {once:true})
		return true
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
