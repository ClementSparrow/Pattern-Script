class Vec
{
	constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
	scal(a) { return new Vec(a*this.x, a*this.y, a*this.z) }
	dot(u) { return u.x*this.x + u.y*this.y + u.z*this.z }
	add(u) { return new Vec(this.x+u.x, this.y+u.y, this.z+u.z) }
	sub(u) { return new Vec(this.x-u.x, this.y-u.y, this.z-u.z) }
	cross(u) { return new Vec(
		this.y*u.z-this.z*u.y,
		this.z*u.x-this.x*u.z,
		this.x*u.y-this.y*u.x
	) }
	toArray() { return [ this.x, this.y, this.z ] }
	some(f) { return f(this.x) || f(this.y) || f(this.z) }
	map(f) { return new Vec(f(this.x), f(this.y), f(this.z)) }
	max() { return Math.max(this.x, this.y, this.z) }
	min() { return Math.min(this.x, this.y, this.z) }
	cproduct(v) { return new Vec(this.x*v.x, this.y*v.y, this.z*v.z) }
	cdiv(v) { return new Vec(this.x/v.x, this.y/v.y, this.z/v.z) }
	static null = new Vec(0, 0, 0)
	static x_axis = new Vec(1, 0, 0)
	static y_axis = new Vec(0, 1, 0)
	static z_axis = new Vec(0, 0, 1)
	static diag_axis = new Vec(1, 1, 1)
	static white = new Vec(255, 255, 255)
	static gray = Vec.diag_axis.scal(127.5)
	static cube_vertexes = Array.from(
		cartesian_product([-1,1], [-1,1], [-1,1]),
		u => new Vec(...u)
	)
}

class Quaternion
{
	constructor(w, v) { this.w = w; this.v = v; }
	conj() { return new Quaternion(this.w, this.v.scal(-1)) }
	mult(q) { return new Quaternion(
		this.w*q.w - this.v.dot(q.v),
		q.v.scal(this.w).add( this.v.scal(q.w) ).sub( this.v.cross(q.v) )
	)}
	normalize() {
		const l = Math.sqrt(this.w*this.w + this.v.dot(this.v))
		return (Math.abs(l) < 0.0001) ? this : new Quaternion(this.w/l, this.v.scal(1/l))
	}
	static x_axis = new Quaternion(0, Vec.x_axis)
	static y_axis = new Quaternion(0, Vec.y_axis)
	static z_axis = new Quaternion(0, Vec.z_axis)
}

PaletteWidget = function(container, item_def)
{
	this.colors = item_def.colors
	this.z = 0

	const colorspaces = {
		rg: new Quaternion(1, Vec.null), // xyz = rgb => no rotation
		gb: new Quaternion(0.5, Vec.diag_axis.scal(0.5)), // xyz = gbr 120° rotation (cos 60°=1/2, sin 60°=√3/2) around diagonal [1,1,1] of length √3
		// bg: { w: 0.7071067812, v: [0, -0.7071067812, 0]}, // xyz = bg-r -90° rotation (cos -45°=√2/2, sin -45°=-√2/2) around diagonal g
		br: new Quaternion(-0.5, Vec.diag_axis.scal(0.5)), // xyz = brg 240° rotation (cos 120°=-1/2, sin 120°=√3/2) around diagonal of length √3
		// hsb: if v is transformed in v' after rotating around axis u, then u.v = u.v' <=> u.(v-v')=0. => u = (v-v')x(w-w') normalized
		// here, v is the cube's diagonal (1,1,1)/√3 and v'=(0,0,1), w=(0,1,0) and w'= (0,sinΩ,cosΩ) with Ω the angle between v and w
		// => sinΩ=|(1,1,1)x(0,1,0)|/√3 = |(-1,0,1)|/√3 = √2/√3 => w'=(0,√2,1)/√3
		// => u = (1,1,1-√3)/√3x(0,1-√2/,-1)/√3=(-1-(1-√3)(1-√2),1,1-√2)/3 = (-2+√2+√3-√6,1,1-√2)/3 to be renormalized
		// the rotation angle has sin = |(v-(v.u)u)x(v'-(v'.u)u)|/|v-(v.u)u)||v'-(v'.u)u)|...
		hsb: new Quaternion(0.8804762392398382, new Vec(-0.27984814235734057, 0.364705199662564, 0.11591689596228216)),
	}

	this.colorspace_buttons = make_HTML('div', {classes:['colorspace_buttons']})
	for (const [label, quaternion] of Object.entries(colorspaces))
	{
		this.colorspace_buttons.appendChild(make_HTML('button', {
			attr: {type: 'button'},
			text: label,
			events: {
				click: (e) => this.setActiveColorSpace(label, quaternion),
				mouseenter: (e) => this.startColorSpaceTransition(quaternion),
				mouseleave: (e) => this.startColorSpaceTransition(colorspaces[this.active_colorspace]),
			},
		}))
	}
	container.appendChild(this.colorspace_buttons)

	this.colorpicker_canvas = make_HTML('canvas', {
		attr: {width: 256, height: 256},
		events: {
			click: e => this.click_in_colorspace(e),
			mousedown: e => this.start_colordrag(e),
		},
	})
	container.appendChild(this.colorpicker_canvas)

	this.zbar_canvas = make_HTML('canvas', {
		attr: {width: 16, height: 256},
		events: {mousedown: e => this.start_zdrag(e)}
	})
	container.appendChild(this.zbar_canvas)

	this.sprite_canvas = make_HTML('canvas', {style: {width: '256px', height: '256px'}})
	container.appendChild(this.sprite_canvas)

	this.setActiveColorSpace('rg', colorspaces['rg'], 1)
}

// WIP TODO:
// - move colors around with drag and drop or click
// - change this.z by directly clicking in the zbar
// - add rrggbb field to enter color directly as hex value
// - add copy/paste options for colors and palettes

PaletteWidget.prototype = {

//	COORDINATES CONVERSIONS
//	=======================

	color_from_space: function(x, y, z)
	{
		const base = this.x_color.scal(x-127.5).add(this.y_color.scal(127.5-y)).add(Vec.gray)
		// 0 < base[c]+(z-127.5)*z_color[c] < 255
		// => -base[c] < (z-127.5)*z_color[c] < 255 - base[c]
		// => 127.5 - base[c]/z_color[c] < z < 127.5 + (255 - base[c])/z_color[c] if z_color[c] > 0
		//    127.5 + (255 - base[c])/z_color[c] < z < 127.5 - base[c]/z_color[c] if z_color[c] < 0
		const min_z = Math.max(  0, 127.5 + this.z_color.map( c => (c<0) ? 255 : 0 ).sub(base).cdiv(this.z_color).max() )
		const max_z = Math.min(255, 127.5 + this.z_color.map( c => (c<0) ? 0 : 255 ).sub(base).cdiv(this.z_color).min() )
		const new_z = (1-z/255)*min_z + max_z*z/255
		return base.add(this.z_color.scal(new_z-127.5))
	},

	color_to_space: function(r, g, b)
	{
		const s = this.color_scale * this.color_scale
		const color = new Vec(r, g, b).sub(Vec.gray)
		return new Vec(
				this.x_color.dot(color),
				this.y_color.dot(color),
				this.z_color.dot(color),
			).scal(1/s).add(Vec.gray)
	},

//	EDIT CONTENT
//	============

	addColor: function(color)
	{
		const color_as_array = color.toArray()
		this.colors.push(color_as_array)
		this.sprite_editor.content.content.palette.push('rgb('+color_as_array.join(',')+')')
		this.sprite_editor.content.glyphSelectedIndex = this.colors.length - 1
		this.sprite_editor.resize_canvas()
		this.redraw()
		this.onChangeContent(this)
	},


//	EDIT STATE
//	==========

	setActiveColorSpace: function(name, quaternion, dt)
	{
		this.active_colorspace = name
		this.colorspace_buttons.querySelectorAll('button').forEach(b => (b.innerText == name) ? b.classList.add('selected') : b.classList.remove('selected'))
		this.startColorSpaceTransition(quaternion, dt)
		// console.log('set quaternion:', quaternion)
	},

	startColorSpaceTransition: function(q, dt)
	{
		this.quaternion_goal = q
		this.quaternion_start = this.quaternion_current || q
		this.dt = dt || 0
		this.lastframe_timestamp = null
		if (this.frame_request !== undefined)
		{
			window.cancelAnimationFrame(this.frame_request)
		}
		this.updateColorSpaceTransition(null)
	},

	updateColorSpaceTransition: function(timestamp)
	{
		let q = this.quaternion_goal
		if (this.dt < 1)
		{
			const diff = this.quaternion_goal.mult(this.quaternion_start.conj())
			const theta0 = Math.acos(diff.w)*2
			const theta = (theta0 > Math.PI) ? theta0 - 2*Math.PI : theta0
			if (Math.abs(theta) > 0.0001 )
			{
				q = new Quaternion(Math.cos(theta*this.dt/2), diff.v.scal(Math.sin(theta*this.dt/2)/Math.sin(theta0/2))).mult(this.quaternion_start)
			}
			// q = normalize(new Quaternion( // nlerp
			// 	t1*this.quaternion_start.w + t2*this.quaternion_goal.w,
			// 	this.quaternion_start.v.scal(t1).add(this.quaternion_goal.v.scal(t2)),
			// ))
		}
		this.quaternion_current = q

		const q_conj = q.conj()
		this.x_color = q_conj.mult( Quaternion.x_axis.mult(q) ).v
		this.y_color = q_conj.mult( Quaternion.y_axis.mult(q) ).v
		this.z_color = q_conj.mult( Quaternion.z_axis.mult(q) ).v

		// rescale to fit the whole cube projection in the canvas
		this.color_scale = Math.max(...Array.from(
			Vec.cube_vertexes,
			v => Math.max(Math.abs(this.x_color.dot(v)), Math.abs(this.y_color.dot(v)))
		))
		this.x_color = this.x_color.scal(this.color_scale)
		this.y_color = this.y_color.scal(this.color_scale)
		this.z_color = this.z_color.scal(this.color_scale)
		
		this.redraw()

		if (this.dt < 1)
		{
			this.frame_request = window.requestAnimationFrame(ts => this.updateColorSpaceTransition(ts))
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


//	DRAW
//	====

	drawField: function(canvas, color_func)
	{
		const ctx = canvas.getContext('2d')
		const [w, h] = [canvas.width, canvas.height]
		if (canvas.image_data === undefined) canvas.image_data = ctx.getImageData(0, 0, w, h)
		const pixels = canvas.image_data.data
		for (let y=0, i=0; y<h; ++y)
		{
			for (let x=0; x<w; ++x, i+=4)
			{
				const color = color_func(x, y, this.z)
				if (color.some(c => (c<=-0.5) || (c>255.5)))
				{
					pixels.fill(0, i, i+3) // black
				}
				else
				{
					pixels[i  ] = color.x
					pixels[i+1] = color.y
					pixels[i+2] = color.z
				}
				pixels[i+3] = 255
			}
		}
		ctx.putImageData(canvas.image_data, 0, 0)
	},

	drawMark: function(canvas, pos, fill_color, stroke_color, size=10, shape=0)
	{
		const ctx = canvas.getContext('2d')
		ctx.save()
		ctx.translate(pos[0], pos[1])
		if (shape == 2) ctx.rotate(Math.PI / 4)
		if (shape != 1) ctx.translate(-size/2, -size/2)
		ctx.fillStyle = fill_color
		ctx.strokeStyle = stroke_color
		if (shape == 1)
		{
			ctx.beginPath()
			ctx.arc(0, 0, size/2, 0, 2*Math.PI)
			ctx.fill()
			ctx.stroke()
		}
		else
		{
			ctx.fillRect(  0, 0, size, size)
			ctx.strokeRect(0, 0, size, size)
		}
		ctx.restore()
	},

	redraw: function()
	{
		this.drawField(this.colorpicker_canvas, (x,y,z) => this.color_from_space(x,y,z))
		this.drawField(this.zbar_canvas, (x,y,z) => this.z_color.scal(255-y) )
		for (const [i, [r,g,b]] of this.colors.entries())
		{
			const color_string = 'rgb('+r+','+g+','+b+')'
			const screen_coords = this.color_to_space(r, g, b)
			const [size, shape] = (this.sprite_editor !== undefined) && (i == this.sprite_editor.content.glyphSelectedIndex) ? [12, 1] : [7, 2]
			const contrast_color = 'black'
			this.drawMark(this.colorpicker_canvas, [screen_coords.x, 255 - screen_coords.y], color_string, contrast_color, size, shape)
			this.drawMark(this.zbar_canvas, [this.zbar_canvas.width/3, 255 - screen_coords.z],  color_string, contrast_color, size, shape)
		}
		this.drawMark(this.zbar_canvas, [2*this.zbar_canvas.width/3, 255 - this.z], 'white', 'black', 10, 0)
	},

//	MOUSE EVENTS
//	============

	click_in_colorspace: function (e)
	{
		if (this.color_dragged === undefined)
			this.addColor(this.color_from_space(e.offsetX, e.offsetY, this.z))
		this.color_dragged = undefined
		return true
	},

	start_colordrag: function(event)
	{
		const x = event.offsetX
		const y = 255 - event.offsetY

	//	Find the closest color point
		const color_positions = this.colors.map( ([r,g,b]) => this.color_to_space(r,g,b) )
		const color_deltas = color_positions.map( c => [x-c.x, y-c.y, this.z-c.z])
		let index_of_closest = undefined
		let closest_sq_distance = Infinity
		for (const [i, [dx,dy,dz]] of color_deltas.entries())
		{
			const sq_dist = dx*dx + dy*dy
			if (sq_dist < closest_sq_distance)
			{
				index_of_closest = i
				closest_sq_distance = sq_dist
			}
		}

		if (closest_sq_distance > 25)
			return false
		this.color_dragged = index_of_closest
		
		const colordrag = (e) =>
		{
			this.colors[index_of_closest] = this.color_from_space(e.offsetX, e.offsetY, this.z).map(c => clamp(0,c,255)).toArray()
			this.redraw()
			this.sprite_editor.content.content.palette = this.colors.map(color => 'rgb('+color.join(',')+')')
			this.sprite_editor.content.glyphSelectedIndex = index_of_closest
			this.sprite_editor.redraw()
			this.onChangeContent(this)
			return true
		}
		const end_colordrag = (e) => {
			document.removeEventListener('mousemove', colordrag)
			return colordrag(e)
		}
		document.addEventListener('mousemove', colordrag, false)
		document.addEventListener('mouseup', end_colordrag, {once:true})
		return true
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


//	ListTabManager API
//	==================

	finalize: function(item_def)
	{
		this.widget.connected.sprites = []
		this.sprite_editor = new SpriteEditor(this.sprite_canvas, 6, 6, this.colors.map(color => 'rgb('+color.join(',')+')'))
		this.sprite_editor.resize_canvas()
		this.sprite_editor.content.onChangeTool = () => this.redraw()
		this.redraw()
	},

	deepCopy: function(item)
	{
		return { colors: Array.from(item.colors) }
	},

	// WIP TODO: the code in this function is duplicated in the parser for the spritematrix, it should be moved to colors.js
	toHex: function(item)
	{
		return item.colors.map(rgbToHex)
	},

	sameItems: function(item1, item2)
	{
		return this.toHex(item1).join(' ') == this.toHex(item2).join(' ')
	},


}


function PalettesTabManager(html_list)
{
	game_def.palettes = {}
	ListTabManager.call(this, html_list, 'palettes', 'Palette', PaletteWidget)
	this.addNewBlankWidget('default_palette') // WIP TODO: this should only be done if we're loading a blank project
}
PalettesTabManager.prototype = Object.create(ListTabManager.prototype)

PalettesTabManager.prototype.addNewBlankWidget = function(name)
{
	this.addNewWidget(name||'', { colors: [] })
}

PalettesTabManager.prototype.widgetContentChanged = function(widget_manager)
{
	if ( ! this.has_usable_name(widget_manager) )
		return
	const widget = widget_manager.widget
	const sprites = widget.connected.sprites
	for (const sprite of sprites)
	{
		sprite.updatePalette(widget.def.colors)
	}
	ListTabManager.prototype.widgetContentChanged.call(this, widget_manager)
}

PalettesTabManager.prototype.onRemoveWidget = function(widget, name)
{
	// TODO
}

PalettesTabManager.prototype.connectSprite = function(sprite_widget, palette_name)
{
	const widget_manager = this.widgets_by_name[palette_name]
	if (widget_manager !== undefined)
	{
		widget_manager.widget.connected.sprites.push(sprite_widget)
	}
	const palette = game_def.palettes[palette_name]
	return (palette === undefined) ? undefined : palette.colors
}

PalettesTabManager.prototype.disconnectSprite = function(sprite_widget, palette_name)
{
	const widget_manager = this.widgets_by_name[palette_name]
	if (widget_manager === undefined)
		return
	const list = widget_manager.widget.connected.sprites
	const index = list.indexOf(sprite_widget)
	if (index >= 0)
		list.splice(index, 1)
}