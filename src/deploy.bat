docker build --tag frontend .
az acr build --resource-group azr_genaipaxprotection_tst_westeurope_rg_01 --registry setupcontainer --image frontend:latest .
$SUBSCRIPTION_ID = az account show --query id --output tsv
az webapp create --resource-group azr_genaipaxprotection_tst_westeurope_rg_01 --plan webplan --name paxprotection-tst --assign-identity [system] --role AcrPull --scope /subscriptions/$SUBSCRIPTION_ID/resourceGroups/azr_genaipaxprotection_tst_westeurope_rg_01 --acr-use-identity --acr-identity [system] --container-image-name setupcontainer.azurecr.io/frontend:latest
