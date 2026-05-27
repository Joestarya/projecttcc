import React, { useState, useEffect } from 'react';
import { Container, Typography, Card, CardContent, Button, Box, CircularProgress, Alert } from '@mui/material';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../services/api';

const ScanQR = () => {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    // Inisialisasi Scanner
    const scanner = new Html5QrcodeScanner("reader", {
      qrbox: { width: 250, height: 250 },
      fps: 5,
    });

    scanner.render(
      (decodedText) => {
        // Ketika berhasil membaca barcode
        scanner.clear();
        handleValidateQR(decodedText);
      },
      (error) => {
        // Error scan berulang, bisa diabaikan
      }
    );

    return () => {
      scanner.clear();
    };
  }, []);

  const handleValidateQR = async (qrCode) => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await api.get(`/attendees/qr/${qrCode}`);
      if (response.data.success) {
        setScanResult(response.data.data);
        if (response.data.data.check_in_status === 'checked_in') {
          setError('Tiket sudah pernah digunakan (Checked In)!');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memvalidasi QR Code atau Tiket Tidak Ditemukan');
      setScanResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!scanResult) return;
    
    setLoading(true);
    try {
      const response = await api.put(`/attendees/checkin/${scanResult.qr_code}`);
      if (response.data.success) {
        setSuccess('Berhasil Check-In!');
        setScanResult({ ...scanResult, check_in_status: 'checked_in' });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal Check-In');
    } finally {
      setLoading(false);
    }
  };

  const resumeScanning = () => {
    setScanResult(null);
    setError('');
    setSuccess('');
    // Scanner.resume() requires reference, but for simplicity we just rely on component reload or we can just say "Refresh the page to scan again" 
    // or re-mount the component. In this case, we'll force reload to re-init scanner.
    window.location.reload(); 
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Scanner Tiket (Gate Keeper)
        </Typography>
        
        {!scanResult && (
          <Card>
            <CardContent>
              <div id="reader" width="100%"></div>
            </CardContent>
          </Card>
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
        
        {loading && <CircularProgress sx={{ mt: 2 }} />}

        {scanResult && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h5" color="primary">Detail Tiket Valid</Typography>
              <Typography variant="body1"><b>Nama Pembeli:</b> {scanResult.User?.full_name}</Typography>
              <Typography variant="body1"><b>Email:</b> {scanResult.User?.email}</Typography>
              <Typography variant="body1"><b>Event:</b> {scanResult.Event?.title}</Typography>
              <Typography variant="body1"><b>Kategori Tiket:</b> {scanResult.Ticket?.category}</Typography>
              <Typography variant="body1" sx={{ mt: 1, color: scanResult.check_in_status === 'checked_in' ? 'red' : 'green', fontWeight: 'bold' }}>
                Status: {scanResult.check_in_status === 'checked_in' ? 'SUDAH DIGUNAKAN' : 'BELUM DIGUNAKAN'}
              </Typography>
              
              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                {scanResult.check_in_status !== 'checked_in' && (
                  <Button variant="contained" color="success" onClick={handleCheckIn} disabled={loading}>
                    Konfirmasi Check-In
                  </Button>
                )}
                <Button variant="outlined" onClick={resumeScanning}>
                  Scan Tiket Lain
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default ScanQR;
