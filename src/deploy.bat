docker build --tag frontend .
az acr build --resource-group azr_genaipaxprotection_tst_westeurope_rg_01 --registry setupcontainer --image frontend:latest .
$SUBSCRIPTION_ID = az account show --query id --output tsv
az webapp create --resource-group azr_genaipaxprotection_tst_westeurope_rg_01 --plan webplan --name paxprotection-tst --assign-identity [system] --role AcrPull --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/azr_genaipaxprotection_tst_westeurope_rg_01 --acr-use-identity --acr-identity [system] --container-image-name setupcontainer.azurecr.io/frontend:latest





az acr build --resource-group aif2025 --registry aif2025container --image usorchestratorv9:latest .




az webapp create --resource-group aif2025 --plan aif2025planprem --name us-orchestrator --assign-identity [system] --role AcrPull --scope /subscriptions/26aa39d8-205e-45bb-8752-b30d1ac3f217/resourceGroups/aif2025 --acr-use-identity --acr-identity [system] --container-image-name aif2025container.azurecr.io/usorchestratorv9:latest
