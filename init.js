Hooks.on("init", () => {
    game.settings.register("wfrp4e-eureka", "initialized", {
    name: "Initialization",
    scope: "world",
    config: false,
    default: false,
    type: Boolean
    });

    game.settings.registerMenu("wfrp4e-eureka", "init-dialog", {
        name: "WFRP4e Eureka! Initialization",
        label : "Initialize",
        hint : "This will import content for the inventive WFRP4e adventure Eureka!",
        type : WFRP4eEurekaWrapper,
        restricted: true
    })
})

Hooks.on("ready", () => {
    if (!game.settings.get("wfrp4e-eureka", "initialized") && game.user.isGM)
    {
        new WFRP4eEurekaInitialization().render(true)
    } 
})


class WFRP4eEurekaWrapper extends FormApplication {
    render() {
        new WFRP4eEurekaInitialization().render(true);
    }
}

class WFRP4eEurekaInitialization extends Dialog{
    constructor()
    {
        super({
            title: "WFRP4e Eureka! Initialization",
            content: `<p class="notes"><img src="modules/wfrp4e-eureka/assets/icons/logo2.png" 
			style="display: block;  margin-left: auto;  margin-right: auto;">
			
			<h4>The Inventive Adventure for Warhammer Fantasy Roleplay</h4>
			<p class="notes">The PDF of Eureka! is free and is <strong>needed to use this Foundry module.</strong><br/><br/>				
			
			Pressing Initialize will install Journals, Actors and Scenes into your world and place map pins on the maps.<br/><br/>
			
			Original Written by <b>Kevin Hargraves</b><br/>
			Token and Portrait Art by <b>Alessandro Boer</b><br/>
			Original 4E Conversion by <b>Stuart Kerrigan</b><br/>
			Special thanks to: <b>Russell Thurman (Moo Man)</b><br/><br/>
            Foundry Edition by <b>Stuart Kerrigan</b><br/>
			
			You can email us at <a href="mailto:perilousrealmpodcast@gmail.com">perilousrealmpodcast@gmail.com</a>
			
			<p class="notes"><strong>Want to support us?</strong><br/><br/>
			
			This module is freeware, and always will be, and other free WFRP modules are planned. As the WFRP content now requires payment to Cubicle 7 there are some running costs so if you want to donate then the link below is provided.<br/><br/>
			
			<a href="https://paypal.me/perilousrealm?locale.x=en_GB"><img src="modules/wfrp4e-eureka/paypal.png" style="display: block;  margin-left: auto; margin-right: auto;" alt="paypal" /></a><br/><br/>
			
			You can also listen to the <a href="https://anchor.fm/peril">Perilous Realm Podcast</a><br/><br/><a href="https://anchor.fm/peril"><img src="modules/wfrp4e-eureka/peril.png" style="display: block;  margin-left: auto;  margin-right: auto;" alt="peril logo"></a> <br/><br/>Lastly do share with us at <a href="mailto:perilousrealmpodcast@gmail.com">perilousrealmpodcast@gmail.com</a> any streams or audio you have of your adventures with Eureka!</p>
            `,

            buttons: {
	            initialize: {
	                label : "Initialize",
	                callback : async () => {
	                    game.settings.set("wfrp4e-eureka", "initialized", true)
	                    await new WFRP4eEurekaInitialization().initialize()
	                    ui.notifications.notify("Initialization Complete")
						}
	                },
	                no: {
	                    label : "No",
	                    callback : () => {
    	                    game.settings.set("wfrp4e-eureka", "initialized", true)
                            ui.notifications.notify("Skipped Initialization.")
                        }
                		}	
                	}
        })
        
        this.folders = {
            "Scene" : {},
            "Item" : {},
            "Actor" : {},
            "JournalEntry" : {}
        }
        this.SceneFolders = {};
        this.ActorFolders = {};
        this.ItemFolders = {};
        this.JournalEntryFolders = {};
        this.journals = {};
        this.scenes = {};
        this.moduleKey = "wfrp4e-eureka"
    }

    async initialize() {
        return new Promise((resolve) => {
            fetch(`modules/${this.moduleKey}/initialization.json`).then(async r => r.json()).then(async json => {
                let createdFolders = await Folder.create(json)
                for (let folder of createdFolders)
                    this.folders[folder.data.type][folder.data.name] = folder;

                for (let folderType in this.folders) {
                    for (let folder in this.folders[folderType]) {

                        let parent = this.folders[folderType][folder].getFlag(this.moduleKey, "initialization-parent")
                        if (parent) {
                            let parentId = this.folders[folderType][parent].data._id
                            await this.folders[folderType][folder].update({ parent: parentId })
                        }
                    }
                }

                await this.initializeEntities()
                await this.initializeScenes()
                resolve()
            })
        })
    }

    async initializeEntities() {

        let packList= [ `${this.moduleKey}.NightOfBloodActors`,
                    `${this.moduleKey}.NightOfBloodScenes`,
                    `${this.moduleKey}.NightOfBloodJournal`]

        for( let pack of packList)
        {
			console.log(pack);
            let content = await game.packs.get(pack).getContent();
            for (let entity of content)
            {
                let folder = entity.getFlag(this.moduleKey, "initialization-folder")
                if (folder)
                    entity.data.folder = this.folders[entity.entity][folder].data._id;
            }
            switch(content[0].entity)
            {
                case "Actor": 
                    ui.notifications.notify("Initializing Actors")
                    await Actor.create(content.map(c => c.data))
                    break;
                case "Item":
                    ui.notifications.notify("Initializing Items")
                    await Item.create(content.map(c => c.data))
                    break;
                case "JournalEntry" :
                    ui.notifications.notify("Initializing Journals")
                    let createdEntries = await JournalEntry.create(content.map(c => c.data))
                    if (!createdEntries.length)
                        break
                    for (let entry of createdEntries)
                        this.journals[entry.data.name] = entry
                    break;
            }
        }
    }

    async initializeScenes() {
        ui.notifications.notify("Initializing Scenes")
        let m = game.packs.get(`${this.moduleKey}.NightOfBloodScenes`)
        let maps = await m.getContent()
        for (let map of maps)
        {
            let folder = map.getFlag(this.moduleKey, "initialization-folder")
            if (folder)
                map.data.folder = this.folders["Scene"][folder].data._id;

            let journalName = map.getFlag(this.moduleKey, "scene-note")
            if (journalName)
                map.data.journal = game.journal.getName(journalName).data._id;

            map.data.notes.forEach(n => {
                try {
                    n.entryId = this.journals[getProperty(n, `flags.${this.moduleKey}.initialization-entryName`)].data._id
                }
                catch (e) {
                    console.log("wfrp4e | INITIALIZATION ERROR: " + e)
                }
            })
        }
        await Scene.create(maps.map(m => m.data)).then(sceneArray => {
            sceneArray.forEach(async s => {
                let thumb = await s.createThumbnail();
                s.update({"thumb" : thumb.thumb})
            })
        })
    }
}


class WFRP4eEurekaInitializationSetup {

    static async setup() 
    {
        WFRP4eEurekaInitializationSetup.displayFolders()
        WFRP4eEurekaInitializationSetup.setFolderFlags()
        WFRP4eEurekaInitializationSetup.setEmbeddedEntities()
    }

/** This gets every folder in the system */
    static async displayFolders() {
        let array = [];
        game.folders.entities.forEach(async f => {
            if (f.data.parent)
                await f.setFlag("wfrp4e-eureka", "initialization-parent", game.folders.get(f.data.parent).data.name)
        })
        game.folders.entities.forEach(f => {
            array.push(f.data)
        })
        console.log(JSON.stringify(array))
    }

    static async setFolderFlags() {
        for (let scene of game.scenes.entities)
            await scene.setFlag("wfrp4e-eureka", "initialization-folder", game.folders.get(scene.data.folder).data.name)
        for (let actor of game.actors.entities)
            await actor.setFlag("wfrp4e-eureka", "initialization-folder", game.folders.get(actor.data.folder).data.name)
        for (let journal of game.journal.entities)
            await journal.setFlag("wfrp4e-eureka", "initialization-folder", game.folders.get(journal.data.folder).data.name)

        WFRP4eEurekaInitializationSetup.setSceneNotes();
    }

    static async setSceneNotes() {
        for (let scene of game.scenes.entities)
            if (scene.data.journal)
                await scene.setFlag("wfrp4e-eureka", "scene-note", game.journal.get(scene.data.journal).data.name)
    }

    static async setEmbeddedEntities() {
        for (let scene of game.scenes.entities)
        {
            let notes = duplicate(scene.data.notes)
            for (let note of notes)
            {
                setProperty(note, "flags.wfrp4e-eureka.initialization-entryName", game.journal.get(note.entryId).data.name)
            }
            await scene.update({notes : notes})
        }
    }


}