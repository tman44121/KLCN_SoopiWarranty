package com.example.weblongmanloc.dto;

public class SelectionItemDto {

    private String id;
    private String name;
    private String extraInfo;

    public SelectionItemDto() {
    }

    public SelectionItemDto(String id, String name) {
        this.id = id;
        this.name = name;
    }

    public SelectionItemDto(String id, String name, String extraInfo) {
        this.id = id;
        this.name = name;
        this.extraInfo = extraInfo;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getExtraInfo() {
        return extraInfo;
    }

    public void setExtraInfo(String extraInfo) {
        this.extraInfo = extraInfo;
    }
}
