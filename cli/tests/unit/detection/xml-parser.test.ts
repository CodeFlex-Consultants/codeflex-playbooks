import { describe, it, expect } from "vitest";
import { parseSimpleXml, findElements, getTextContent } from "../../../src/detection/xml-parser";

describe("parseSimpleXml", () => {
  it("parses a simple root element", () => {
    const xml = "<Project></Project>";
    const root = parseSimpleXml(xml);

    expect(root.tag).toBe("root");
    expect(root.children).toHaveLength(1);
    expect(root.children[0]!.tag).toBe("Project");
  });

  it("parses nested elements", () => {
    const xml = "<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>";
    const root = parseSimpleXml(xml);

    const project = root.children[0]!;
    expect(project.tag).toBe("Project");
    expect(project.children).toHaveLength(1);

    const propGroup = project.children[0]!;
    expect(propGroup.tag).toBe("PropertyGroup");
    expect(propGroup.children).toHaveLength(1);

    const tfm = propGroup.children[0]!;
    expect(tfm.tag).toBe("TargetFramework");
    expect(tfm.text).toBe("net8.0");
  });

  it("parses attributes", () => {
    const xml = '<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />';
    const root = parseSimpleXml(xml);

    const elem = root.children[0]!;
    expect(elem.tag).toBe("PackageReference");
    expect(elem.attributes.Include).toBe("Newtonsoft.Json");
    expect(elem.attributes.Version).toBe("13.0.3");
  });

  it("parses self-closing tags", () => {
    const xml = '<PackageReference Include="Pkg" Version="1.0" />';
    const root = parseSimpleXml(xml);

    expect(root.children).toHaveLength(1);
    expect(root.children[0]!.tag).toBe("PackageReference");
    expect(root.children[0]!.children).toHaveLength(0);
  });

  it("parses multiple sibling elements", () => {
    const xml = "<Root><A /><B /><C /></Root>";
    const root = parseSimpleXml(xml);

    const rootElem = root.children[0]!;
    expect(rootElem.children).toHaveLength(3);
    expect(rootElem.children[0]!.tag).toBe("A");
    expect(rootElem.children[1]!.tag).toBe("B");
    expect(rootElem.children[2]!.tag).toBe("C");
  });

  it("parses a realistic .csproj file", () => {
    const xml = [
      '<Project Sdk="Microsoft.NET.Sdk.Web">',
      '  <PropertyGroup>',
      '    <TargetFramework>net8.0</TargetFramework>',
      '    <Nullable>enable</Nullable>',
      '  </PropertyGroup>',
      '  <ItemGroup>',
      '    <PackageReference Include="Swashbuckle.AspNetCore" Version="6.5.0" />',
      '    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.2" />',
      '  </ItemGroup>',
      '</Project>',
    ].join("\n");

    const root = parseSimpleXml(xml);
    const project = root.children[0]!;

    expect(project.tag).toBe("Project");
    expect(project.attributes.Sdk).toBe("Microsoft.NET.Sdk.Web");

    const propGroups = findElements(project, "PropertyGroup");
    expect(propGroups).toHaveLength(1);

    const targetFrameworks = findElements(project, "TargetFramework");
    expect(targetFrameworks).toHaveLength(1);
    expect(getTextContent(targetFrameworks[0]!)).toBe("net8.0");

    const packageRefs = findElements(project, "PackageReference");
    expect(packageRefs).toHaveLength(2);
    expect(packageRefs[0]!.attributes.Include).toBe("Swashbuckle.AspNetCore");
    expect(packageRefs[1]!.attributes.Include).toBe("Microsoft.EntityFrameworkCore");
  });

  it("handles empty content", () => {
    const root = parseSimpleXml("");
    expect(root.children).toHaveLength(0);
  });

  it("handles content with no tags", () => {
    const root = parseSimpleXml("just plain text");
    expect(root.children).toHaveLength(0);
  });
});

describe("findElements", () => {
  it("finds elements by tag name recursively", () => {
    const xml = "<Root><A><B /><B /></A><B /></Root>";
    const root = parseSimpleXml(xml);

    const bElements = findElements(root, "B");
    expect(bElements).toHaveLength(3);
  });

  it("returns empty array when no elements match", () => {
    const xml = "<Root><A /></Root>";
    const root = parseSimpleXml(xml);

    const result = findElements(root, "NonExistent");
    expect(result).toHaveLength(0);
  });

  it("finds deeply nested elements", () => {
    const xml = "<A><B><C><D><Target>found</Target></D></C></B></A>";
    const root = parseSimpleXml(xml);

    const result = findElements(root, "Target");
    expect(result).toHaveLength(1);
    expect(getTextContent(result[0]!)).toBe("found");
  });
});

describe("getTextContent", () => {
  it("returns text content of an element", () => {
    const xml = "<Root><Item>hello world</Item></Root>";
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(getTextContent(item)).toBe("hello world");
  });

  it("returns empty string for element with no text", () => {
    const xml = "<Root><Item /></Root>";
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(getTextContent(item)).toBe("");
  });
});

describe("parseSimpleXml edge cases", () => {
  it("handles CDATA sections by preserving inner content as text", () => {
    const xml = "<Root><Item><![CDATA[some <special> content & more]]></Item></Root>";
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(getTextContent(item)).toBe("some <special> content & more");
  });

  it("handles CDATA within a csproj-like structure", () => {
    const xml = [
      '<Project Sdk="Microsoft.NET.Sdk">',
      '  <PropertyGroup>',
      '    <Description><![CDATA[A project with <angle> brackets & stuff]]></Description>',
      '  </PropertyGroup>',
      '</Project>',
    ].join("\n");

    const root = parseSimpleXml(xml);
    const desc = findElements(root, "Description")[0]!;
    expect(getTextContent(desc)).toBe("A project with <angle> brackets & stuff");
  });

  it("handles attributes with single quotes", () => {
    const xml = "<Root><Item attr='single-quoted' /></Root>";
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(item.attributes["attr"]).toBe("single-quoted");
  });

  it("handles mixed single and double quoted attributes", () => {
    const xml = `<Root><Item double="val1" single='val2' /></Root>`;
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(item.attributes["double"]).toBe("val1");
    expect(item.attributes["single"]).toBe("val2");
  });

  it("handles namespace prefixes in tag names", () => {
    const xml = "<root><ns:Item>namespaced</ns:Item></root>";
    const root = parseSimpleXml(xml);

    const item = findElements(root, "ns:Item")[0]!;
    expect(getTextContent(item)).toBe("namespaced");
  });

  it("handles namespace prefixes in attributes", () => {
    const xml = `<Root><Item xmlns:custom="http://example.com" custom:attr="ns-value" /></Root>`;
    const root = parseSimpleXml(xml);

    const item = findElements(root, "Item")[0]!;
    expect(item.attributes["xmlns:custom"]).toBe("http://example.com");
    expect(item.attributes["custom:attr"]).toBe("ns-value");
  });

  it("handles self-closing tags with extra spaces", () => {
    const xml = "<Root><Item   /><Another  / ></Root>";
    const root = parseSimpleXml(xml);

    const rootElem = root.children[0]!;
    expect(rootElem.children).toHaveLength(2);
    expect(rootElem.children[0]!.tag).toBe("Item");
    expect(rootElem.children[1]!.tag).toBe("Another");
  });

  it("handles malformed XML gracefully without throwing", () => {
    const xml = "<Root><Unclosed><AlsoBad</Root>";
    expect(() => parseSimpleXml(xml)).not.toThrow();
  });

  it("handles completely broken XML gracefully", () => {
    const xml = "<<<>>>not xml at all<<<>>>";
    expect(() => parseSimpleXml(xml)).not.toThrow();
    const root = parseSimpleXml(xml);
    expect(root.tag).toBe("root");
  });

  it("handles a csproj with CDATA, single quotes, and namespaces together", () => {
    const xml = [
      '<Project Sdk="Microsoft.NET.Sdk" xmlns:ns="http://example.com">',
      '  <PropertyGroup>',
      "    <TargetFramework>net8.0</TargetFramework>",
      "    <Notes><![CDATA[Supports 'single' and \"double\" quotes]]></Notes>",
      "  </PropertyGroup>",
      '  <ItemGroup>',
      "    <PackageReference Include='Test.Package' Version=\"1.0.0\" />",
      "  </ItemGroup>",
      '</Project>',
    ].join("\n");

    const root = parseSimpleXml(xml);
    const project = root.children[0]!;
    expect(project.attributes["Sdk"]).toBe("Microsoft.NET.Sdk");
    expect(project.attributes["xmlns:ns"]).toBe("http://example.com");

    const tfm = findElements(project, "TargetFramework")[0]!;
    expect(getTextContent(tfm)).toBe("net8.0");

    const notes = findElements(project, "Notes")[0]!;
    expect(getTextContent(notes)).toContain("single");
    expect(getTextContent(notes)).toContain("double");

    const pkgRefs = findElements(project, "PackageReference");
    expect(pkgRefs).toHaveLength(1);
    expect(pkgRefs[0]!.attributes["Include"]).toBe("Test.Package");
    expect(pkgRefs[0]!.attributes["Version"]).toBe("1.0.0");
  });
});
