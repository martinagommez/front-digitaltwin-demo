export interface PluginRequest {
    NumberOfPlugins : number,
    PluginList: PluginMeta[]
}

export interface PluginMeta {
    PluginDescription: string,
    PluginTitle: string,
    PluginHost: string,
    PluginType: string,
    PluginKeys: PluginKeys
}


export interface PluginKeys {
    orch_config_id: string,
    orch_config_key: string,
}


