/**
 * Units Breakdown Component
 * 
 * Displays detailed list of core and elective units for a qualification
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen } from 'lucide-react';
import type { QualificationUnit } from '@/lib/types/qualifications';

interface UnitsBreakdownProps {
  units: QualificationUnit[];
}

export function UnitsBreakdown({ units }: UnitsBreakdownProps) {
  const [search, setSearch] = useState('');

  const coreUnits = units.filter((u) => u.unit_type === 'core' && u.is_current);
  const electiveUnits = units.filter((u) => u.unit_type === 'elective' && u.is_current);

  const filteredUnits = (type?: 'core' | 'elective') => {
    let filtered = units.filter((u) => u.is_current);
    
    if (type) {
      filtered = filtered.filter((u) => u.unit_type === type);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.unit_code.toLowerCase().includes(searchLower) ||
          u.unit_title.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  };

  const calculateTotalHours = (unitsList: QualificationUnit[]) => {
    return unitsList.reduce((total, unit) => total + (unit.nominal_hours || 0), 0);
  };

  if (units.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Units Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No units defined yet</p>
            <p className="text-sm mt-1">Sync with TGA to import unit data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Units Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="all">
                All Units ({units.filter((u) => u.is_current).length})
              </TabsTrigger>
              <TabsTrigger value="core">Core ({coreUnits.length})</TabsTrigger>
              <TabsTrigger value="elective">Elective ({electiveUnits.length})</TabsTrigger>
            </TabsList>
            
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search units..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <TabsContent value="all" className="mt-0">
            <UnitsTable units={filteredUnits()} totalHours={calculateTotalHours(filteredUnits())} />
          </TabsContent>

          <TabsContent value="core" className="mt-0">
            <UnitsTable units={filteredUnits('core')} totalHours={calculateTotalHours(filteredUnits('core'))} />
          </TabsContent>

          <TabsContent value="elective" className="mt-0">
            <UnitsTable units={filteredUnits('elective')} totalHours={calculateTotalHours(filteredUnits('elective'))} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function UnitsTable({ units, totalHours }: { units: QualificationUnit[]; totalHours: number }) {
  if (units.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No units match your search</p>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Hours</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.map((unit) => (
            <TableRow key={unit.id}>
              <TableCell className="font-mono text-sm">{unit.unit_code}</TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{unit.unit_title}</p>
                  {unit.field_of_education && (
                    <p className="text-xs text-muted-foreground mt-1">{unit.field_of_education}</p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={unit.unit_type === 'core' ? 'default' : 'outline'} className="capitalize">
                  {unit.unit_type || 'N/A'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{unit.nominal_hours || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {totalHours > 0 && (
        <div className="mt-4 flex justify-end border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground mr-2">Total Hours:</span>
            <span className="font-semibold">{totalHours}</span>
          </div>
        </div>
      )}
    </div>
  );
}
