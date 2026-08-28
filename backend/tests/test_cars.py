import pytest
from cars import get_car_by_ordinal

def test_known_ordinal_number():
    assert get_car_by_ordinal(383) == "2005 BMW M3 E46"
    assert get_car_by_ordinal(3767) == "2022 Acura NSX Type S"
    assert get_car_by_ordinal(247) == "1969 Toyota 2000 GT"
    assert get_car_by_ordinal(2544) == "2016 Dodge Viper ACR"

def test_known_ordinal_string():
    assert get_car_by_ordinal("383") == "2005 BMW M3 E46"
    assert get_car_by_ordinal("3767") == "2022 Acura NSX Type S"
    assert get_car_by_ordinal("  383  ") == "2005 BMW M3 E46"

def test_unknown_ordinal():
    assert get_car_by_ordinal(99999) == "Unknown Vehicle"
    assert get_car_by_ordinal(888888) == "Unknown Vehicle"
    assert get_car_by_ordinal("99999") == "Unknown Vehicle"

def test_null_and_none_ordinal():
    assert get_car_by_ordinal(None) == "Unknown Vehicle"

def test_malformed_and_edge_case_ordinals():
    assert get_car_by_ordinal(0) == "Unknown Vehicle"
    assert get_car_by_ordinal(-1) == "Unknown Vehicle"
    assert get_car_by_ordinal(-383) == "Unknown Vehicle"
    assert get_car_by_ordinal("invalid_ordinal") == "Unknown Vehicle"
    assert get_car_by_ordinal("") == "Unknown Vehicle"
    assert get_car_by_ordinal("   ") == "Unknown Vehicle"
    assert get_car_by_ordinal([]) == "Unknown Vehicle"
    assert get_car_by_ordinal({}) == "Unknown Vehicle"
    assert get_car_by_ordinal(float("nan")) == "Unknown Vehicle"
