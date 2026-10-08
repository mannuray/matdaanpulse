import { AdminPersonsController } from './admin-persons.controller';

describe('AdminPersonsController.searchPersons', () => {
  const make = () => {
    const persons = { search: jest.fn().mockResolvedValue([{ id: 'p1', name: 'Nitish Kumar' }]) };
    return { persons, ctrl: new AdminPersonsController(persons as any, {} as any, {} as any) };
  };

  it('a query shorter than 2 characters (after trimming) answers [] without querying, never 50 arbitrary persons', async () => {
    const { persons, ctrl } = make();
    await expect(ctrl.searchPersons({ q: '' })).resolves.toEqual([]);
    await expect(ctrl.searchPersons({ q: 'a' })).resolves.toEqual([]);
    expect(persons.search).not.toHaveBeenCalled();
  });

  it('searches with the (DTO-trimmed) query', async () => {
    const { persons, ctrl } = make();
    await expect(ctrl.searchPersons({ q: 'ni' })).resolves.toEqual([{ id: 'p1', name: 'Nitish Kumar' }]);
    expect(persons.search).toHaveBeenCalledWith('ni');
  });
});
