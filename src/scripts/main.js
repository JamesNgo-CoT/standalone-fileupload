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
									form.cotForm.dropzones[field['id']].resetFiles(value);
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

	CotForm.prototype.render = function(options) {
		originalCotForm.prototype.render.call(this, options);
		if (this.cotForm.finalizerScripts) {
			for (const script of this.cotForm.finalizerScripts) {
				script();
			}
		}
	}

	CotForm.prototype.finalizeDropzone = function(cbk) {
		if (this.cotForm.dropzones) {
			const keys = Object.keys(this.cotForm.dropzones);
			let idx = 0;
			const finalize = () => {
				if (idx < keys.length) {
					this.cotForm.dropzones[keys[idx]].finalize(() => {
						idx = idx + 1;
						finalize();
					});
				} else {
					if (cbk) {
						cbk();
					}
				}
			}
			finalize();
		}
	}
})(CotForm);

cot_form.prototype.dropzoneFieldRender = function(fieldOpts) {
	if (!this.dropzones) {
		this.dropzones = {};
	}
	if (!this.finalizerScripts) {
		this.finalizerScripts = [];
	}

	const $el = $(`<div><input id="${fieldOpts.id}" type="hidden"><div class="dropzone" id="${fieldOpts.id}Dropzone" style="margin-bottom: 5px;"></div><button class="btn btn-default" id="${fieldOpts.id}Btn" style="margin: 0;">Select File to Upload</button></div>`);

	this.finalizerScripts.push(() => {
		const $hiddenInput = $(`#${fieldOpts.id}`);
		const options = $.extend({
			addRemoveLinks: true,
			clickable: `#${fieldOpts.id}Btn`,
			url: fieldOpts.options.url,

			init: function() {
				this.initFiles = [];
				this.on('completemultiple', function() {
					this.setHiddenIntput();
				});
				this.on('removedfile', function() {
					this.setHiddenIntput();
				});
			},
		}, fieldOpts.options);

		const dz = this.dropzones[fieldOpts.id] = new Dropzone(`#${fieldOpts.id}Dropzone`, options);
		dz.resetFiles = function(files) {
			if (!Array.isArray(files)) {
				try {
					files = JSON.parse(files);
					if (!Array.isArray(files)) {
						files = [];
					}
				} catch (e) {
					files = [];
				}
			}
			this.initFiles = files.map((file) => {
				file.status = 'initial';
				return file;
			});
			this.removeAllFiles(true);
			for (const file of files) {
				this.emit('addedfile', file);
				this.emit('complete', file);
				this.files.push(file);
			}
			this.setHiddenIntput();
		};
		dz.setHiddenIntput = function() {
			const value = this.files.filter((file) => file.status == 'initial' || file.status == 'success').map((file) => {
				return {
					bin_id: file.bin_id || JSON.parse(file.xhr.responseText).BIN_ID[0],
					name: file.name,
					size: file.size,
					type: file.type
				};
			});
			$hiddenInput.val(JSON.stringify(value)).trigger('change');
			console.log($hiddenInput.val()); // TODO - Remove console log.
		};
		dz.finalize = function(cbk) {

			//Step 2 - Delete and keep uploaded files.
			const step2 = () => {
				const deletable = this.initFiles.filter((file) => this.files.indexOf(file) == -1).map((file) => file.bin_id || JSON.parse(file.xhr.responseText).BIN_ID[0]);
				// let deletableIdx = 0;
				// const doDeletable = () => {
				// 	if (deletableIdx < deletable.length) {
				// 		console.log('DELETE URL', `https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/binUtils/${fieldOpts.app}/${fieldOpts.group}/${deletable[deletableIdx]}/delete?sid=uIX-SlHU-zzYqn9urgJRtyTMno9Hvz5tL3y7EnfFXwo`);
				// 		$.get(`https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/binUtils/${fieldOpts.app}/${fieldOpts.group}/${deletable[deletableIdx]}/delete?sid=uIX-SlHU-zzYqn9urgJRtyTMno9Hvz5tL3y7EnfFXwo`, (data) => {
				// 			console.log('DELET', data);
				// 			deletableIdx = deletableIdx + 1;
				// 			doKeepable();
				// 		});
				// 	} else {
				// 		if (cbk) {
				// 			this.resetFiles(this.files);
				// 			cbk();
				// 		}
				// 	}
				// };

				const keepable = this.files.filter((file) => this.initFiles.indexOf(file) == -1).map((file) => file.bin_id || JSON.parse(file.xhr.responseText).BIN_ID[0]);
				// let keepableIdx = 0;
				// const doKeepable = () => {
				// 	if (keepableIdx < keepable.length) {
				// 		console.log(`https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/binUtils/${fieldOpts.app}/${fieldOpts.group}/${keepable[keepableIdx]}/keep?sid=uIX-SlHU-zzYqn9urgJRtyTMno9Hvz5tL3y7EnfFXwo`);
				// 		$.get(`https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/binUtils/${keepable[keepableIdx]}/keep?sid=uIX-SlHU-zzYqn9urgJRtyTMno9Hvz5tL3y7EnfFXwo`, (data) => {
				// 			console.log('KEEP', data);
				// 			keepableIdx = keepableIdx + 1;
				// 			doKeepable();
				// 		});
				// 	} else {
				// 		doDeletable();
				// 	}
				// }

				// doKeepable();

				// console.log('KEEP URL', `https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/binUtils/${fieldOpts.app}/${keepable[keepableIdx]}/keep?keepFiles=${keepable.join(',')}`);
				// $.get(`https://was-intra-sit.toronto.ca/cc_sr_admin_v1/submit/appfactory/it_jngo2/jngo2_myDef?keepFiles=${keepable.join(',')}`, (data) => {
				// 	console.log('KEEP', data);
				// });
				cbk({
					delete: deletable,
					keep: keepable
				});
			}

			// Step 1 - Process unprocessed Queue
			const step1 = () => {
				console.log('step1');
				if (this.getQueuedFiles().length > 0) {
					const processQueueComplete = () => {
						this.off('completemultiple', processQueueComplete);
						step1();
					};
					this.on('completemultiple', processQueueComplete);
					this.processQueue();
				} else {
					step2();
				}
			};
			step1();
		};

		dz.resetFiles(fieldOpts.value);
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
							autoProcessQueue: false,
							uploadMultiple: true,
							url: 'https://was-intra-sit.toronto.ca/cc_sr_admin_v1/upload/jngo2/jngo2'
						},
						value: [{
							"bin_id": "Qj3ML3jiKRAiIHwrE4P1hw",
							"name": "test.txt",
							"type": "text/plain",
							"size": 6
						}],
						bindTo: 'dropzoneField',
					}]
				}, {
					fields: [{
						id: 'button',
						title: 'Button',
						type: 'button',
						onclick: (e) => {
							e.preventDefault();
							cotForm.finalizeDropzone(() => {
								console.log('done.');
							});
						}
					}]
				}]
			}]
		});
		cotApp.addForm(cotForm, 'top', true);

		const cotFormModel = app.cotFormModel = app.cotFormModel = new CotModel({
			textField: 'test',
			dropzoneField: [{
				"bin_id": "Qj3ML3jiKRAiIHwrE4P1hw",
				"name": "test.txt",
				"type": "text/plain",
				"size": 6
			}]
		});
		cotForm.setModel(cotFormModel);
	});
});
