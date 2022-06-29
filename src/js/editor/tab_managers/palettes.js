
PaletteWidget = function(container, item_def)
{
	this.colors = []
	this.z = 0

	const colorspaces = {
		rg: { w:   1, v: [0, 0, 0]}, // xyz = rgb => no rotation
		gb: { w: 0.5, v: [0.5, 0.5, 0.5]}, // xyz = gbr 120° rotation (cos 60°=1/2, sin 60°=√3/2) around diagonal [1,1,1] of length √3
		// bg: { w: 0.7071067812, v: [0, -0.7071067812, 0]}, // xyz = bg-r -90° rotation (cos -45°=√2/2, sin -45°=-√2/2) around diagonal g
		br: { w:-0.5, v: [0.5, 0.5, 0.5]}, // xyz = brg 240° rotation (cos 120°=-1/2, sin 120°=√3/2) around diagonal of length √3
		hsl:{ w: 0.5773502692, v: [0.8164965809, -0.8164965809, 0.8164965809]},
	}

	this.colorspace_buttons = document.createElement('div')
	this.colorspace_buttons.classList.add('colorspace_buttons')
	for (const [label, quaternion] of Object.entries(colorspaces))
	{
		const button = document.createElement('button')
		button.setAttribute('type', 'button')
		button.innerText = label
		button.addEventListener('click', (e) => this.setActiveColorSpace(label, quaternion), false )
		button.addEventListener('mouseenter', (e) => this.changeColorSpace(quaternion), false )
		button.addEventListener('mouseleave', (e) => this.changeColorSpace(colorspaces[this.active_colorspace]), false )
		this.colorspace_buttons.appendChild(button)
	}
	container.appendChild(this.colorspace_buttons)

	this.colorpicker_canvas = document.createElement('canvas')
	this.colorpicker_canvas.width = 256
	this.colorpicker_canvas.height = 256
	container.appendChild(this.colorpicker_canvas)
	this.colorpicker_canvas.addEventListener('click', e => this.addColor(this.color_from_space(e.offsetX, e.offsetY, this.z)), false) // TODO: convert coordinates to color

	this.zbar_canvas = document.createElement('canvas')
	this.zbar_canvas.width = 16
	this.zbar_canvas.height = 256
	container.appendChild(this.zbar_canvas)
	this.zbar_canvas.addEventListener('mousedown', e => this.start_zdrag(e), false)

	this.setActiveColorSpace('rg', colorspaces['rg'], 1)
}

// WIP TODO:
// - move colors around with drag and drop or click
// - add a sprite to showcase the colors in the palette
// - change this.z by directly clicking in the zbar
// - add rrggbb field to enter color directly as hex value
// - add copy/paste options for colors and palettes

PaletteWidget.prototype = {

	color_from_space: function(x, y, z)
	{
		const base = [0,1,2].map(c => 127.5 + (x-127.5)*this.x_color[c] + (127.5-y)*this.y_color[c])
		// 0 < base[c]+(z-127.5)*z_color[c] < 255
		// => -base[c] < (z-127.5)*z_color[c] < 255 - base[c]
		// => 127.5 - base[c]/z_color[c] < z < 127.5 + (255 - base[c])/z_color[c] if z_color[c] > 0
		//    127.5 + (255 - base[c])/z_color[c] < z < 127.5 - base[c]/z_color[c] if z_color[c] < 0
		const min_z = Math.max(0,   ...base.map( (v,c) => 127.5 + ((this.z_color[c]<0 ? 255 : 0)-v)/this.z_color[c]))
		const max_z = Math.min(255, ...base.map( (v,c) => 127.5 + ((this.z_color[c]<0 ? 0 : 255)-v)/this.z_color[c]))
		const new_z = (1-z/255)*min_z + max_z*z/255
		return base.map( (v,c) => v+(new_z-127.5)*this.z_color[c])
	},

	addColor: function(color)
	{
		this.colors.push(color)
		this.redraw()
	},

	setActiveColorSpace: function(name, quaternion, dt)
	{
		this.active_colorspace = name
		this.colorspace_buttons.querySelectorAll('button').forEach(b => (b.innerText == name) ? b.classList.add('selected') : b.classList.remove('selected'))
		this.changeColorSpace(quaternion, dt)
	},

	changeColorSpace: function(q, dt)
	{
		this.quaternion_goal = q
		this.quaternion_start = this.quaternion_current || q
		this.dt = dt || 0
		this.lastframe_timestamp = null
		this.updateColorSpace(null)
	},

	updateColorSpace: function(timestamp)
	{
		const dot = (u,v) => u[0]*v[0] + u[1]*v[1] + u[2]*v[2]
		const scal = (a,u) => u.map(c => a*c)
		const sum = (u,v) => [u[0]+v[0], u[1]+v[1], u[2]+v[2]]
		const sub = (u,v) => [u[0]-v[0], u[1]-v[1], u[2]-v[2]]
		const cross = (u,v) => [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
		const conj = (q) => ({ w: q.w, v: scal(-1, q.v) })
		const mult = (p, q) => ({
			w: p.w*q.w - dot(p.v, q.v),
			v: sub( sum(scal(p.w,q.v), scal(q.w,p.v)), cross(p.v, q.v) )
		})
		const normalize = (p) => { const l = Math.sqrt(p.w*p.w + dot(p.v, p.v)); return (Math.abs(l) < 0.0001) ? p : {w: p.w/l, v: scal(1/l, p.v) } }

		const q = (this.dt > 1) ? this.quaternion_goal : normalize({ // nlerp
			w: (1-this.dt)*this.quaternion_start.w + this.dt*this.quaternion_goal.w,
			v: sum(scal(1-this.dt, this.quaternion_start.v), scal(this.dt, this.quaternion_goal.v)),
		})
		this.quaternion_current = q

		this.x_color = mult( conj(q), mult({w:0, v:[1,0,0]}, q) ).v
		this.y_color = mult( conj(q), mult({w:0, v:[0,1,0]}, q) ).v
		this.z_color = mult( conj(q), mult({w:0, v:[0,0,1]}, q) ).v
		// console.log(mult({ w: 0.8164965809, v: [0.5773502692, 0, 0]}, { w: 0.9238795325, v: [0, 0.3826834324, 0]}))
		// sin(acos(sqrt(2)/sqrt(3)))
		this.redraw()

		if (this.dt < 1)
		{
			window.requestAnimationFrame(ts => this.updateColorSpace(ts))
			if (this.lastframe_timestamp !== null)
			{
				this.dt = Math.min(1, this.dt + (timestamp - this.lastframe_timestamp)/450 ) // ms
			}
			this.lastframe_timestamp = timestamp
		}
		else
		{
			this.lastframe_timestamp = null
			this.dt = 1
		}
	},

	drawField: function(canvas, color_func)
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
				const color = color_func(x, y, this.z)
				if (color.some(c => (c<=-0.5) || (c>255.5)))
					continue
				pixels[i  ] = color[0]
				pixels[i+1] = color[1]
				pixels[i+2] = color[2]
				pixels[i+3] = 255
			}
		}
		ctx.putImageData(image_data, 0, 0)
	},

	drawMark: function(canvas, pos, fill_color, stroke_color)
	{
		const ctx = canvas.getContext('2d')
		ctx.fillStyle = fill_color
		ctx.fillRect(pos[0]-5, pos[1]-5, 10, 10)
		ctx.strokeStyle = stroke_color
		ctx.strokeRect(pos[0]-5, pos[1]-5, 10, 10)
	},

	redraw: function()
	{
		this.drawField(this.colorpicker_canvas, (x,y,z) => this.color_from_space(x,y,z))
		this.drawField(this.zbar_canvas, (x,y,z) => this.z_color.map(c => c*(255-y)) )
		this.drawMark(this.zbar_canvas, [this.zbar_canvas.width/2, 255-this.z], 'white', 'black')
		for (const [r,g,b] of this.colors)
		{
			const color_string = 'rgb('+r+','+g+','+b+')'
			const screen_coords = [
				this.x_color[0]*r + this.x_color[1]*g + this.x_color[2]*b,
				this.y_color[0]*r + this.y_color[1]*g + this.y_color[2]*b,
				this.z_color[0]*r + this.z_color[1]*g + this.z_color[2]*b,
			]
			this.drawMark(this.colorpicker_canvas, [screen_coords[0], 255 - screen_coords[1]], color_string, 'black')
			this.drawMark(this.zbar_canvas, [this.zbar_canvas.width, 255 - screen_coords[2]], color_string, 'black')
		}
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
