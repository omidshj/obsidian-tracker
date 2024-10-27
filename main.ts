import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';
import MarkdownIt from 'markdown-it';


// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	activities: any[]
	async onload() {
		await this.loadSettings();
		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('table', 'Sample Plugin', async (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.activities = []
			await this.readFiles()
			await this.write()
			
			
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async readFiles(){


		await this.readNestedFiles(this.app.vault.getFolderByPath('diary/log') as TFolder);
		// this.handleFile(this.app.vault.getFileByPath('diary/2024/17.md') as TFile);
	}
	async readNestedFiles(folder: TFolder) {
		// Loop through the folder's children
		for (const child of folder.children) {
			if (child instanceof TFile) {
				// Handle file if it's a TFile instance
				await this.handleFile(child);
			} else if (child instanceof TFolder) {
				// Recursively read files in subfolders
				await this.readNestedFiles(child);
			}
		}
	}
	async handleFile(file: TFile) {
		// if (file.name != '17.md') {
		// 	return null
		// }
		var content
		// Read file content using the Vault API
		await this.app.vault.read(file).then((c) => { content = c })
			.catch((err) => { console.error(`Error reading file ${file.path}:`, err);});
		// console.log(`File: ${file.path}`);
		const md = new MarkdownIt();
		const tokens = md.parse(content, {});
		let tag = '', domain = '', project = '', headers = [], rows = [], tdx = 0, tdy = 0, tableMode = undefined, target = undefined, act = undefined, sub = undefined

		for (const token of tokens){
			if (token.type == "inline") {
				if (tag == 'h1') domain = token.content
				else if (tag == 'h2') project = token.content
				else if (tag == 'th'){
					if (tableMode == undefined) tableMode = (token.content == ''? 'table': 'column')
					headers.push(token.content)
				}
				else if (tag == 'td'){
					if (tdx == 0) rows.push(token.content)
					if (tableMode == 'column'){
						if(tdx % 2 == 0){
							if(token.content != '')
								act = token.content
						} else {
							if(token.content != '')
								this.activities.push({file: file.name, domain, project, sub: headers[tdx-1], act, content: token.content})
							target = undefined
						}
					} else if (tableMode == 'table'){
						if(tdx && token.content != ''){
							this.activities.push({file: file.name, domain, project, sub: rows[tdy], act: headers[tdx], content: token.content})
						}
					}
					tdx ++
					if (tdx == headers.length){
						tdx = 0
						tdy = 0
					}
				} 
			} else if (token.type == "table_open"){
			} else if (token.type == "table_close"){
				headers = []
				rows = []
				tdx = 0
				tdy = 0
				tableMode = undefined
			}
			tag = token.tag
		}
		// console.log(`File: ${file.path}\nContent:\n${content}`);

		// console.log({tokens, result})
	}
	async write(){
		
		try {
            // Check if the file exists
			const { vault } = this.app, filePath = 'stats.md'
			var content = '# hiii there\r\n'
			content += '|file|domain|project|act|content|\r\n'
			content += '|---|---|---|---|---|\r\n'
            const existingFile = vault.getAbstractFileByPath(filePath);

			
			console.log(this.activities.length);
			
			for(const act of this.activities){
				content += `|${act.file}|${act.domain}|${act.project}|${act.act}|${act.content}|\r\n`
				// content += `- **domain**: ${act.domain} project: ${act.project} \r\n`
			}
            if (existingFile) {
                // If the file exists, modify it (replace content)
                await vault.modify(existingFile as any, content);
                new Notice(`File "${filePath}" updated successfully.`);
            } else {
                // If the file doesn't exist, create a new one
                await vault.create(filePath, content);
                new Notice(`File "${filePath}" created successfully.`);
            }
        } catch (error) {
            console.error("Error writing to file:", error);
            new Notice("Failed to write to file.");
        }
	}
	async readCurrent(){
		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			console.log("Currently open file:", activeFile);
			this.app.vault.read(activeFile).then(fileContents => {
				console.log("File Contents:", fileContents);
			});
		} else {
			console.log("No file is currently open.");
		}
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
