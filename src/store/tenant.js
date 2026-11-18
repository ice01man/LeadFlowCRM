// Envoltorio multi-tenant: toma un repo "crudo" y devuelve otro con la MISMA API,
// pero atado a una organización. Toda lectura filtra por organizacionId y toda escritura lo fija.
// Así, un servicio que trabaja con db.org(id) no puede leer ni tocar datos de otra organización
// aunque reciba un _id ajeno: para el repo, ese documento simplemente no existe.

export function repoTenant(repo, organizacionId) {
  if (!organizacionId || typeof organizacionId !== 'string') {
    throw new Error('repoTenant: falta organizacionId (error de programación, no del usuario).');
  }
  const conOrg = (filtro = {}) => ({ ...filtro, organizacionId });
  const sinOrg = (data) => {
    // Nadie puede mover un documento de organización ni "inyectar" otra por el body.
    const { organizacionId: _ignorado, _id, ...resto } = data || {};
    return resto;
  };

  return {
    list: (filtro, opciones) => repo.list(conOrg(filtro), opciones),
    findOne: (filtro) => repo.findOne(conOrg(filtro)),
    count: (filtro) => repo.count(conOrg(filtro)),
    async get(id) {
      const doc = await repo.get(id);
      return doc && String(doc.organizacionId) === organizacionId ? doc : null;
    },
    create: (data) => repo.create({ ...sinOrg(data), organizacionId }),
    async update(id, patch) {
      return repo.updateOne({ _id: id, organizacionId }, sinOrg(patch));
    },
    updateOne: (filtro, patch) => repo.updateOne(conOrg(filtro), sinOrg(patch)),
    async remove(id) {
      const doc = await this.get(id);
      return doc ? repo.remove(id) : false;
    },
  };
}
