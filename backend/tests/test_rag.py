from app.rag.knowledge_base import retrieve_relevant_documents


def test_sin_condiciones_solo_trae_documentos_generales():
    docs = retrieve_relevant_documents(None)
    assert len(docs) > 0
    assert all(d["condicion"] == "general" for d in docs)


def test_diabetes_trae_generales_mas_diabetes():
    docs = retrieve_relevant_documents(["diabetes_tipo_2"])
    condiciones = {d["condicion"] for d in docs}
    assert condiciones == {"general", "diabetes"}
    assert any(d["condicion"] == "diabetes" for d in docs)


def test_resistencia_insulina_tambien_mapea_a_diabetes():
    """resistencia_insulina y diabetes_tipo_2 son slugs distintos pero deben
    traer las mismas fichas de diabetes — ambas son variantes de la misma
    categoría clínica en la base de conocimiento."""
    docs_tipo2 = retrieve_relevant_documents(["diabetes_tipo_2"])
    docs_resistencia = retrieve_relevant_documents(["resistencia_insulina"])
    assert {d["id"] for d in docs_tipo2} == {d["id"] for d in docs_resistencia}


def test_enfermedad_renal_trae_generales_mas_renal():
    docs = retrieve_relevant_documents(["enfermedad_renal"])
    condiciones = {d["condicion"] for d in docs}
    assert condiciones == {"general", "renal"}


def test_condicion_sin_categoria_mapeada_solo_trae_generales():
    """SOP no tiene fichas propias todavía en la base de conocimiento — es una
    limitación conocida y documentada, no debe romper ni inventar contenido."""
    docs = retrieve_relevant_documents(["sop"])
    assert all(d["condicion"] == "general" for d in docs)


def test_multiples_condiciones_combinan_todas_las_categorias():
    docs = retrieve_relevant_documents(["diabetes_tipo_2", "enfermedad_renal"])
    condiciones = {d["condicion"] for d in docs}
    assert condiciones == {"general", "diabetes", "renal"}


def test_cada_documento_tiene_fuente_para_trazabilidad():
    docs = retrieve_relevant_documents(["hipertension"])
    assert all(d.get("fuente_id") for d in docs)
