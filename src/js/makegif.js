function makeGIF()
{
	var randomseed = RandomGen.seed;

	var inputDat = inputHistory.concat([]);

	unitTesting=true;
	levelString=compiledText;

	var encoder = new GIFEncoder();
	encoder.setRepeat(0); //auto-loop
	encoder.setDelay(200);
	encoder.start();

	compile(curlevel, levelString, randomseed)
	canvasResize()

	var gifcanvas = document.createElement('canvas');
	const [virtual_screen_w, virtual_screen_h] = screen_layout.content.get_virtual_screen_size()
	gifcanvas.width  = gifcanvas.style.width  = virtual_screen_w * screen_layout.magnification
	gifcanvas.height = gifcanvas.style.height = virtual_screen_h * screen_layout.magnification
	var gifctx = gifcanvas.getContext('2d');

	gifctx.drawImage(canvas, -screen_layout.margins[0], -screen_layout.margins[1]);
  	encoder.addFrame(gifctx);
	var autotimer=0;

  	for(const val of inputDat)
  	{
  		var realtimeframe = false
		if (val === 'undo') {
			execution_context.doUndo()
		} else if (val === 'restart') {
			DoRestart();
		} else if (val === 'tick') {			
			processInput(processing_causes.autotick)
			realtimeframe = true
		} else {
			processInput(val)
		}

		redraw()
		gifctx.drawImage(canvas, -screen_layout.margins[0], -screen_layout.margins[1])
		encoder.addFrame(gifctx)
		encoder.setDelay(realtimeframe ? autotickinterval : repeatinterval)
		autotimer += repeatinterval

		while (againing)
		{
			processInput(processing_causes.again_frame)
			redraw()

			encoder.setDelay(againinterval)
			gifctx.drawImage(canvas, -screen_layout.margins[0], -screen_layout.margins[1])
	  		encoder.addFrame(gifctx)
		}
	}

	encoder.finish();
	const data_url = 'data:image/gif;base64,'+btoa(encoder.stream().getData());
	consolePrint('<img class="generatedgif" src="'+data_url+'">');
	consolePrint('<a href="'+data_url+'" download>Download GIF</a>');
  	
  	unitTesting = false;

    inputHistory = inputDat
}
