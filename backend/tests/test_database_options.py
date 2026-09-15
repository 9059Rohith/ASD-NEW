from app.database import build_mongo_client_options


def test_local_mongodb_does_not_receive_tls_only_options():
    options = build_mongo_client_options(
        "mongodb://localhost:27017",
        allow_invalid_tls_certificates=False,
    )

    assert "tlsAllowInvalidCertificates" not in options


def test_tls_override_is_only_forwarded_for_tls_connections():
    options = build_mongo_client_options(
        "mongodb+srv://cluster.example.test",
        allow_invalid_tls_certificates=True,
    )

    assert options["tlsAllowInvalidCertificates"] is True
