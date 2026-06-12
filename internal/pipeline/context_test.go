package pipeline

import "testing"

func TestGetMetadataProjectsTypedFields(t *testing.T) {
	ctx := &Context{
		Country:      "us",
		ASN:          15169,
		ASNOrg:       "Google LLC",
		IsDatacenter: true,
		AppID:        "app-1",
	}

	m := ctx.GetMetadata()

	if m["country"] != "us" {
		t.Errorf("country = %v, want us", m["country"])
	}
	if m["asn"] != uint(15169) {
		t.Errorf("asn = %v (%T), want uint 15169", m["asn"], m["asn"])
	}
	if m["asn_org"] != "Google LLC" {
		t.Errorf("asn_org = %v", m["asn_org"])
	}
	if m["is_datacenter"] != true {
		t.Errorf("is_datacenter = %v, want true", m["is_datacenter"])
	}
	if m["app_id"] != "app-1" {
		t.Errorf("app_id = %v", m["app_id"])
	}
}

func TestGetMetadataAlwaysIncludesIsDatacenter(t *testing.T) {
	// is_datacenter must be present even when false, so rules comparing it
	// against false behave deterministically.
	ctx := &Context{}
	m := ctx.GetMetadata()
	v, ok := m["is_datacenter"]
	if !ok {
		t.Fatal("is_datacenter must always be projected")
	}
	if v != false {
		t.Fatalf("is_datacenter = %v, want false", v)
	}
}

func TestGetMetadataMergesExtra(t *testing.T) {
	ctx := &Context{Country: "de"}
	ctx.SetExtra("ja4", "t13d1234")
	ctx.SetExtra("matched_rule_id", 42)

	m := ctx.GetMetadata()
	if m["ja4"] != "t13d1234" {
		t.Errorf("ja4 = %v", m["ja4"])
	}
	if m["matched_rule_id"] != 42 {
		t.Errorf("matched_rule_id = %v", m["matched_rule_id"])
	}
	if m["country"] != "de" {
		t.Errorf("country = %v", m["country"])
	}
}

func TestGetMetadataEmptyFieldsOmitted(t *testing.T) {
	ctx := &Context{}
	m := ctx.GetMetadata()
	if _, ok := m["country"]; ok {
		t.Error("empty country should be omitted")
	}
	if _, ok := m["asn"]; ok {
		t.Error("zero asn should be omitted")
	}
	if _, ok := m["app_id"]; ok {
		t.Error("empty app_id should be omitted")
	}
}

func TestSetGetExtra(t *testing.T) {
	ctx := &Context{}
	if _, ok := ctx.GetExtra("missing"); ok {
		t.Error("missing key should report not-ok")
	}
	ctx.SetExtra("k", "v")
	v, ok := ctx.GetExtra("k")
	if !ok || v != "v" {
		t.Errorf("GetExtra = %v, %v; want v, true", v, ok)
	}
}
