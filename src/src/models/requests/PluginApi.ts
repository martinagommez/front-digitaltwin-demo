export interface PluginRequest {
    NumberOfPlugins : number,
    PluginList: PluginMeta[]
}

export interface PluginMeta {
    PluginDescription: string,
    PluginTitle: string,
    PluginHost: string,
    PluginType: string,
}


