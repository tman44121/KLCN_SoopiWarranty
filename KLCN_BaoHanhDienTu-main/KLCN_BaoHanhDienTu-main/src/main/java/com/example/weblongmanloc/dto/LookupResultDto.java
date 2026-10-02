package com.example.weblongmanloc.dto;

public class LookupResultDto {

    private boolean found;
    private String lookupType; // "DEVICE" or "TICKET"
    private String serialOrCode;
    private String productName;
    private String brandName;
    private String customerName;
    private String activationDate;
    private String expiryDate;
    private String warrantyStatus; // "ACTIVE", "EXPIRING_SOON", "EXPIRED"
    private String warrantyStatusBadge;
    private String warrantyBadgeClass;
    private String message;

    public LookupResultDto() {
    }

    public boolean isFound() {
        return found;
    }

    public void setFound(boolean found) {
        this.found = found;
    }

    public String getLookupType() {
        return lookupType;
    }

    public void setLookupType(String lookupType) {
        this.lookupType = lookupType;
    }

    public String getSerialOrCode() {
        return serialOrCode;
    }

    public void setSerialOrCode(String serialOrCode) {
        this.serialOrCode = serialOrCode;
    }

    public String getProductName() {
        return productName;
    }

    public void setProductName(String productName) {
        this.productName = productName;
    }

    public String getBrandName() {
        return brandName;
    }

    public void setBrandName(String brandName) {
        this.brandName = brandName;
    }

    public String getCustomerName() {
        return customerName;
    }

    public void setCustomerName(String customerName) {
        this.customerName = customerName;
    }

    public String getActivationDate() {
        return activationDate;
    }

    public void setActivationDate(String activationDate) {
        this.activationDate = activationDate;
    }

    public String getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(String expiryDate) {
        this.expiryDate = expiryDate;
    }

    public String getWarrantyStatus() {
        return warrantyStatus;
    }

    public void setWarrantyStatus(String warrantyStatus) {
        this.warrantyStatus = warrantyStatus;
    }

    public String getWarrantyStatusBadge() {
        return warrantyStatusBadge;
    }

    public void setWarrantyStatusBadge(String warrantyStatusBadge) {
        this.warrantyStatusBadge = warrantyStatusBadge;
    }

    public String getWarrantyBadgeClass() {
        return warrantyBadgeClass;
    }

    public void setWarrantyBadgeClass(String warrantyBadgeClass) {
        this.warrantyBadgeClass = warrantyBadgeClass;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
