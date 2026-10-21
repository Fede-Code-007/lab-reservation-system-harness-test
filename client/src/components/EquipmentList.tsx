import type { Equipment } from '../types';

interface EquipmentListProps {
  equipment: Equipment[];
  selectedEquipmentId: string;
  onSelect: (equipmentId: string) => void;
  loading: boolean;
}

export function EquipmentList({ equipment, selectedEquipmentId, onSelect, loading }: EquipmentListProps) {
  if (loading) {
    return <p className="hint">Cargando el inventario…</p>;
  }

  if (equipment.length === 0) {
    return <p className="hint">La API no devolvió equipos.</p>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th scope="col">
            <span className="visually-hidden">Seleccionar</span>
          </th>
          <th scope="col">ID</th>
          <th scope="col">Equipo</th>
        </tr>
      </thead>
      <tbody>
        {equipment.map((item) => (
          <tr key={item.id} className={item.id === selectedEquipmentId ? 'row-selected' : undefined}>
            <td>
              <input
                type="radio"
                name="equipo-seleccionado"
                value={item.id}
                checked={item.id === selectedEquipmentId}
                onChange={() => onSelect(item.id)}
                aria-label={`Seleccionar ${item.id}`}
              />
            </td>
            <td>{item.id}</td>
            <td>{item.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
