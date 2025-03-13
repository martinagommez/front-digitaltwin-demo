
variable "azure_subscription_id" {
  description = "Azure Subscription Id"
  type        = string
  sensitive   = true
}

variable "azure_tenant_id" {
  description = "Azure Tenant Id"
  type        = string
  sensitive   = true
}

variable "azure_service_principal_client_id" {
  description = "Azure Service Principal Client Id"
  type        = string
  sensitive   = true
}

variable "azure_service_principal_client_secret" {
  description = "Azure Service Principal Client Secret"
  type        = string
  sensitive   = true
}

variable "azure_service_principal_object_id" {
  description = "Azure Service Principal Object Id"
  type        = string
  sensitive   = true
}

variable "devops_organization_service_url" {
  description = "URL de la organización en DevOps"
  type        = string
  sensitive   = true
}

variable "devops_personal_token" {
  description = "Personal Token"
  type        = string
  sensitive   = true
}

variable "azure_group_studios_member"{
  type        = string
  description = "Object Id del grupo Studios Member"
}

