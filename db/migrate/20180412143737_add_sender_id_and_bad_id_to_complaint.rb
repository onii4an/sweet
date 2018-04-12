class AddSenderIdAndBadIdToComplaint < ActiveRecord::Migration[5.1]
  def change
    add_column :complaints, :sender_id, :integer
    add_column :complaints, :bad_id, :integer
  end
end
