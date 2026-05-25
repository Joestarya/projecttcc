const { Order, Ticket, Event, Attendee, User } = require('../models');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

// Create a new order
const createOrder = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { event_id, ticket_id, quantity, payment_method } = req.body;
    const user_id = req.user.id;

    // Validate ticket and quota
    const ticket = await Ticket.findByPk(ticket_id, { transaction: t });
    if (!ticket || ticket.event_id !== event_id) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Invalid ticket or event' });
    }

    if (ticket.quota - ticket.sold < quantity) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Not enough ticket quota available' });
    }

    // Calculate total price
    const total_price = ticket.price * quantity;
    const transaction_id = 'TRX-' + uuidv4().substring(0, 8).toUpperCase();

    // Create order
    const order = await Order.create({
      user_id,
      event_id,
      ticket_id,
      quantity,
      total_price,
      payment_method,
      transaction_id,
      payment_status: 'pending'
    }, { transaction: t });

    // Update ticket sold count
    await ticket.increment('sold', { by: quantity, transaction: t });

    await t.commit();

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get User's Orders
const getUserOrders = async (req, res) => {
  try {
    const user_id = req.user.id;
    const orders = await Order.findAll({
      where: { user_id },
      include: [
        { model: Event, attributes: ['title', 'date', 'location'] },
        { model: Ticket, attributes: ['category', 'price'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const order = await Order.findOne({
      where: req.user.role === 'admin' ? { id } : { id, user_id },
      include: [
        { model: Event, attributes: ['title', 'date', 'location'] },
        { model: Ticket, attributes: ['category', 'price'] },
        { model: Attendee, attributes: ['id', 'qr_code', 'check_in_status'] }
      ]
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Order Status (and generate Attendees if paid)
const updateOrderStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { payment_status } = req.body; // 'paid', 'failed', 'refunded'

    const order = await Order.findByPk(id, { transaction: t });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // If changing to paid and currently not paid, generate attendees (QR codes)
    if (payment_status === 'paid' && order.payment_status !== 'paid') {
      const attendees = [];
      const user = await User.findByPk(order.user_id, { transaction: t });

      for (let i = 0; i < order.quantity; i++) {
        attendees.push({
          order_id: order.id,
          user_id: order.user_id,
          event_id: order.event_id,
          ticket_id: order.ticket_id,
          qr_code: uuidv4(), // Unique QR for each ticket
          attendee_name: user.full_name,
          attendee_email: user.email,
          check_in_status: 'not_checked'
        });
      }

      await Attendee.bulkCreate(attendees, { transaction: t });
    }

    // If changing from paid to failed/refunded, handle ticket quota? 
    // Usually handled differently, but for simplicity we skip quota restoration here unless requested.

    await order.update({ payment_status }, { transaction: t });

    await t.commit();
    res.json({ success: true, message: `Order status updated to ${payment_status}` });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus
};
