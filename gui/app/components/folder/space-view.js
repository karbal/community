// Copyright 2016 Documize Inc. <legal@documize.com>. All rights reserved.
//
// This software (Documize Community Edition) is licensed under
// GNU AGPL v3 http://www.gnu.org/licenses/agpl-3.0.en.html
//
// You can operate outside the AGPL restrictions by purchasing
// Documize Enterprise Edition and obtaining a commercial license
// by contacting <sales@documize.com>.
//
// https://documize.com

import { all } from 'rsvp';

import { schedule } from '@ember/runloop';
import { gt } from '@ember/object/computed';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import NotifierMixin from '../../mixins/notifier';
import TooltipMixin from '../../mixins/tooltip';
import AuthMixin from '../../mixins/auth';

export default Component.extend(NotifierMixin, TooltipMixin, AuthMixin, {
	router: service(),
	documentService: service('document'),
	folderService: service('folder'),
	localStorage: service('localStorage'),
	selectedDocuments: [],
	hasSelectedDocuments: gt('selectedDocuments.length', 0),
	hasCategories: gt('categories.length', 0),
	showStartDocument: false,
	filteredDocs: [],

	didReceiveAttrs() {
		this._super(...arguments);
		this.setup();
	},

	didUpdateAttrs() {
		this._super(...arguments);
		this.set('selectedDocuments', []);
		this.set('filteredDocs', []);
	},

	didRender() {
		this._super(...arguments);

		if (this.get('rootDocCount') > 0) {
			this.addTooltip(document.getElementById("uncategorized-button"));
		}
	},

	willDestroyElement() {
		this._super(...arguments);

		this.destroyTooltips();
	},

	setup() {
		let categories = this.get('categories');
		let categorySummary = this.get('categorySummary');
		let selectedCategory = '';

		categories.forEach((cat)=> {
			let summary = _.findWhere(categorySummary, {type: "documents", categoryId: cat.get('id')});
			let docCount =  is.not.undefined(summary) ? summary.count : 0;
			cat.set('docCount', docCount);
			if (docCount > 0 && selectedCategory === '') {
				selectedCategory = cat.get('id');
			}
		});

		this.set('categories', categories);

		schedule('afterRender', () => {
			if (this.get('rootDocCount') > 0) {
				this.send('onDocumentFilter', 'space', this.get('folder.id'));
			} else if (selectedCategory !== '') {
				this.send('onDocumentFilter', 'category', selectedCategory);
			}
		});
	},

	actions: {
		onMoveDocument(folder) {
			let self = this;
			let documents = this.get('selectedDocuments');

			documents.forEach(function (documentId) {
				self.get('documentService').getDocument(documentId).then(function (doc) {
					doc.set('folderId', folder);
					doc.set('selected', !doc.get('selected'));
					self.get('documentService').save(doc).then(function () {
						self.attrs.onRefresh();
					});
				});
			});

			this.set('selectedDocuments', []);
			this.send("showNotification", "Moved");
		},

		onDeleteDocument(documents) {
			let self = this;
			let promises = [];

			documents.forEach(function (document, index) {
				promises[index] = self.get('documentService').deleteDocument(document);
			});

			all(promises).then(() => {
				let documents = this.get('documents');
				documents.forEach(function (document) {
					document.set('selected', false);
				});

				this.set('documents', documents);
				this.set('selectedDocuments', []);
				this.attrs.onRefresh();
			});
		},

		onImport() {
			this.attrs.onRefresh();
		},

		onStartDocument() {
			this.set('showStartDocument', !this.get('showStartDocument'));
		},

		onHideStartDocument() {
			this.set('showStartDocument', false);
		},

		onDocumentFilter(filter, id) {
			let docs = this.get('documents');
			let categories = this.get('categories');
			let categoryMembers = this.get('categoryMembers');
			let filtered = [];
			let allowed = [];

			switch (filter) {
				case 'category':
					allowed = _.pluck(_.where(categoryMembers, {'categoryId': id}), 'documentId');
					docs.forEach((d) => {
						if (_.contains(allowed, d.get('id'))) {
							filtered.pushObject(d);
						}
					});

					this.set('spaceSelected', false);
					this.set('uncategorizedSelected', false);
					break;

				case 'uncategorized':
					allowed = _.pluck(categoryMembers, 'documentId');
					docs.forEach((d) => {
						if (!_.contains(allowed, d.get('id'))) {
							filtered.pushObject(d);
						}
					});

					this.set('uncategorizedSelected', true);
					this.set('spaceSelected', false);
					break;

				case 'space':
					allowed = _.pluck(categoryMembers, 'documentId');
					docs.forEach((d) => {
						filtered.pushObject(d);
					});

					this.set('spaceSelected', true);
					this.set('uncategorizedSelected', false);
					break;
			}

			categories.forEach((cat)=> {
				cat.set('selected', cat.get('id') === id);
			});

			this.set('categories', categories);
			this.set('filteredDocs', filtered);
		}
	}
});
