/* global cot_form app Dropzone */

((originalCotForm) => {
	CotForm = function(definition) {
		if (!definition) {
			throw new Error('You must supply a form definition');
		}
		this._isRendered = false;
		this._definition = definition;
		this._useBinding = definition['useBinding'] || false;
		this._model = null;
		this.cotForm = new cot_form({
			id: definition['id'] || 'new_form',
			title: definition['title'],
			rootPath: definition['rootPath'],
			success: definition['success'] || function() {}
		});
		var that = this;
		var bindableTypes = ['text', 'dropdown', 'textarea', 'checkbox', 'radio', 'password', 'multiselect', 'dropzone'];
		$.each(definition['sections'] || [], function(i, sectionInfo) {
			var section = that.cotForm.addSection({
				id: sectionInfo['id'] || 'section' + i,
				title: sectionInfo['title'],
				className: sectionInfo['className']
			});
			$.each(sectionInfo['rows'] || [], function(y, row) {
				if (row['fields']) {
					row['fields'].forEach(function(field) {
						var type = field['type'] || 'text';
						if (field['bindTo'] && bindableTypes.indexOf(type) === -1) {
							throw new Error('Error in field ' + (field['id'] || 'no id') + ', fields of type ' + type + ' cannot use bindTo.');
						}
					});
					section.addRow(row['fields']);
				} else if (row['grid']) {
					section.addGrid(row['grid']);
				}
			});
		});
	}
	CotForm.prototype = Object.create(originalCotForm.prototype);
	CotForm.prototype.constructor = CotForm;

	CotForm.prototype._fillFromModel = function() {
		var form = this;
		if (this._isRendered) {
			(this._definition['sections'] || []).forEach(function(sectionInfo) {
				(sectionInfo['rows'] || []).forEach(function(row) {
					(row['fields'] || []).forEach(function(field) {
						//TODO: support grids
						if (field['bindTo']) {
							var value = form._model ? (form._model.get(field['bindTo']) || '') : '';
							switch (field['type']) {
								case 'radio':
								case 'checkbox':
									$.makeArray(value).forEach(function(val) {
										var fld = $('input[name="' + field['id'] + '"][value="' + val + '"]');
										if (fld.length) {
											fld[0].checked = true;
										}
									});
									break;
								case 'multiselect':
									$('#' + field['id']).multiselect('select', $.makeArray(value));
									break;
								case 'dropzone':
									// NEW DROPZONE
									form.cotForm.dropzoneData[field['id']].resetDropzone(value);
									break;
								default:
									$('#' + field['id']).val(value);
									break;
							}
						}
					});
				});
			});
		}
	};
	CotForm.prototype._watchChanges = function() {
		var form = this;
		if (this._isRendered) {
			(this._definition['sections'] || []).forEach(function(sectionInfo) {
				(sectionInfo['rows'] || []).forEach(function(row) {
					(row['fields'] || []).forEach(function(field) {
						//TODO: support grids
						if (field['bindTo']) {
							if (field['type'] == 'radio') {
								$('input[name="' + field['id'] + '"]').on('click', function(e) {
									if (form._model) {
										form._model.set(field['bindTo'], $(e.currentTarget).val());
									}
								});
							} else if (field['type'] == 'checkbox') {
								$('input[name="' + field['id'] + '"]').on('click', function(e) {
									if (form._model) {
										var value = $(e.currentTarget).val();
										var values = $.makeArray(form._model.get(field['bindTo']) || []).slice();
										var currentIndex = (values).indexOf(value);
										if (e.currentTarget.checked && currentIndex == -1) {
											values.push(value);
										} else if (!e.currentTarget.checked && currentIndex > -1) {
											values.splice(currentIndex, 1);
										}
										form._model.set(field['bindTo'], values);
									}
								});
							} else if (field['type'] == 'dropzone') {
								// NEW DROPZONE
								$('#' + field['id']).on('change', function(e) {
									if (form._model) {
										let newVal
										try {
											newVal = JSON.parse($(e.currentTarget).val());
										} catch (e) {
											newVal = [];
										}
										form._model.set(field['bindTo'], newVal);
									}
								});
							} else {
								$('#' + field['id']).on('change', function(e) {
									if (form._model) {
										var newVal = $(e.currentTarget).val();
										if (field['type'] === 'multiselect' && field['multiple'] && !newVal) {
											newVal = [];
										}
										form._model.set(field['bindTo'], newVal);
									}
								});
							}
						}
					});
				});
			});
		}
	};

	CotForm.prototype.render = function (options) {
		originalCotForm.prototype.render.call(this, options);
		if (this.cotForm.finalScripts) {
			for (const script of this.cotForm.finalScripts) {
				script();
			}
		}
	}

	CotForm.prototype.finalizeDropzone = function() {
		if (this.cotForm.dropzoneData) {
			console.log(this.cotForm.dropzoneData);
			// TODO
			for (const key in this.cotForm.dropzoneData) {
				const data = this.cotForm.dropzoneData[key];
				const baseBinIds = data.baseFiles.map((baseFile) => baseFile.binId);
				const finalBinIds = data.finalFiles.map((fileFile) => fileFile.binId);
				console.log('-->', data, baseBinIds, finalBinIds);
				console.log('deletable', baseBinIds.filter((binId) => finalBinIds.indexOf(binId) == -1));
				console.log('keepable', finalBinIds.filter((binId) => baseBinIds.indexOf(binId) == -1));
			}
		}
	}
})(CotForm);

// cot_form.prototype.dropzoneFieldRender = function(fieldOpts, label) {
cot_form.prototype.dropzoneFieldRender = function(fieldOpts) {
	const id = fieldOpts.id;
	const $el = $(`<div><input id="${id}" type="hidden"><div class="dropzone" id="${id}Dropzone" style="margin-bottom: 5px;"></div><button class="btn btn-default" id="${id}Btn" style="margin: 0;">Select File to Upload</button></div>`);

	const $hidden = $(`#${id}`, $el);
	if (!this.dropzoneData) {
		this.dropzoneData = {};
	}
	const data = this.dropzoneData[id] = {
		baseFiles: [],
		finalFiles: [],
		resetDropzone: (value) => {
			if (!value || typeof value !== 'object') {
				value = [];
			}
			data.baseFiles = value.filter(() => true);
			data.finalFiles = value.filter(() => true);
			$hidden.val(JSON.stringify(value)).trigger('change');

			const dz = Dropzone.forElement(`#${id}Dropzone`);
			dz.removeAllFiles(true);
			for (const file of value) {
				const finalFile = {
					binId: file.binId,
					name: file.name,
					type: file.type,
					size: file.size
				};
				dz.emit('addedfile', finalFile);
				dz.emit('complete', finalFile);
				dz.files.push(finalFile); // Fixes a bug
			}
		}
	};

	const options = $.extend({
		addRemoveLinks: true,
		clickable: `#${id}Btn`,
		init: function() {
			const value = !fieldOpts.value ? [] : typeof fieldOpts.value == 'object' ? fieldOpts.value : JSON.parse(fieldOpts.value);
			data.resetDropzone(value);
			this.on('success', function(file, responseString) {
				data.finalFiles.push({
					binId: JSON.parse(responseString).BIN_ID[0],
					name: file.name,
					type: file.type,
					size: file.size
				});
				$(`#${id}`).val(JSON.stringify(data.finalFiles)).trigger('change');
			});
			this.on('removedfile', function(file) {
				let binId = file.binId || JSON.parse(file.xhr.responseText).BIN_ID[0];
				let counter = 0;
				while(counter < data.finalFiles.length) {
					if (data.finalFiles[counter].binId == binId) {
						data.finalFiles.splice(counter, 1);
					} else {
						counter = counter + 1;
					}
				}
				$(`#${id}`).val(JSON.stringify(data.finalFiles)).trigger('change');
			});
		}
	}, fieldOpts.options);

	if (!this.finalScripts) {
		this.finalScripts = [];
	}
	this.finalScripts.push(() => {
		$(`#${id}Dropzone`).dropzone(options);
	});

	return $el[0];
};







window.app = {};

$(document).ready(function() {
	const cotApp = app.cotApp = new cot_app('');
	app.cotApp.render(function() {
		const cotForm = app.cotForm = new CotForm({
			id: 'my_form_id',
			title: 'My Form',
			rootPath: '/resources/my_app/',
			success: () => {},

			useBinding: true,

			sections: [{
				rows: [{
					fields: [{
						id: 'textField',
						title: 'Text Field',
						bindTo: 'textField'
					}]
				}, {
					fields: [{
						id: 'dropzoneField',
						title: 'Dropzone Field',
						type: 'dropzone',
						options: {
							uploadMultiple: true,
							url: 'https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/jngo2/jngo2',
							// uploadGroup: 'jngo2',
							// uploadSubGroup: 'jngo2',
							// autoQueue: false
						},
						// value: [{"binId":"Qj3ML3jiKRAiIHwrE4P1hw","name":"test.txt","type":"text/plain","size":6}]
						bindTo: 'dropzoneField'
					}]
				}, {
					fields: [{
						id: 'button',
						title: 'Button',
						type: 'button',
						onclick: (e) => {
							e.preventDefault();
							cotForm.finalizeDropzone();
						}
					}]
				}]
			}]
		});
		cotApp.addForm(cotForm, 'top', true);

		const cotFormModel = app.cotFormModel = app.cotFormModel = new CotModel({
			textField: 'test',
			dropzoneField: [{"binId":"Qj3ML3jiKRAiIHwrE4P1hw","name":"test.txt","type":"text/plain","size":6}]
		});
		cotForm.setModel(cotFormModel);
	});
});
